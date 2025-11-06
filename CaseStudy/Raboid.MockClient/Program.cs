using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Security.Claims; // Bu using gereksiz olabilir ancak tutalım

// --- ANA MOCK AKIŞI ---

// DİKKAT: Paralel test için yeni terminalde burayı RPA02, RPA03 olarak değiştirin!
const string ClientId = "RPA02"; 
const string ClientSecret = "secret02";
// NOT: API'niz localhost:5157 portunda çalıştığı için BaseUrl'yi buna göre ayarladık.
const string BaseUrl = "http://localhost:5157/api/"; 

var client = new HttpClient();
client.BaseAddress = new Uri(BaseUrl);

// --- 1. LOGIN OLMA VE TOKEN ALMA ---
Console.WriteLine($"[CLIENT: {ClientId}] Başlatılıyor. Login denemesi yapılıyor...");
var authResponse = await LoginAsync();
if (authResponse == null) return;

string token = authResponse.token;
Console.WriteLine($"[CLIENT: {ClientId}] Token başarıyla alındı. Windows oturumu açılıyor...");

// --- 2. WINDOWS LOGIN SÜRESİNİ MOCKLAMA ---
// Windows oturumu açma süresi ortalama ~1 dakika (60 saniye). 
// Test için bunu 5 saniye tutalım. (Gerçek değer 70 saniye olabilir.)
int loginTimeSeconds = 5; 
Console.WriteLine($"[CLIENT: {ClientId}] Windows oturumu açılıyor simülasyonu... Bekleniyor: {loginTimeSeconds} saniye.");
await Task.Delay(loginTimeSeconds * 1000);

// --- 3. LOGIN ONAYINI GÖNDERME ---
// Scheduler'ın iş ataması yapabilmesi için durumu "LoggedIn" yap.
await ConfirmLoginAsync(ClientId);
Console.WriteLine($"[CLIENT: {ClientId}] Oturum onaylandı ve iş çekmeye hazır.");

// JWT'yi HTTP başlığına ekle
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);


// --- 4. SÜREKLİ İŞ ÇEKME DÖNGÜSÜ ---
while (true)
{
    var job = await GetNextJobAsync();
    
    if (job != null)
    {
        await ProcessJobAsync(job);
    }
    else
    {
        // İş kalmadıysa veya boşta ise, 10 saniye bekle
        Console.WriteLine($"[CLIENT: {ClientId}] İş kalmadı veya API'den iş çekilemedi. 10 saniye bekleniyor.");
        await Task.Delay(10000); 
    }
}


// --- FONKSİYONLAR ---

async Task<dynamic> LoginAsync()
{
    var content = JsonContent.Create(new AuthRequest { ClientId = ClientId, ClientSecret = ClientSecret });
    var response = await client.PostAsync("Auth/login", content);
    
    if (response.IsSuccessStatusCode)
    {
        var json = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
        // Tuple yerine anonymous object döndürüyoruz
        return new { token = result!["token"], clientId = result!["clientId"] }; 
    }
    else
    {
        Console.WriteLine($"[CLIENT: {ClientId}] Login başarısız! Hata Kodu: {response.StatusCode}");
        return null;
    }
}

async Task ConfirmLoginAsync(string clientId)
{
    var response = await client.PostAsync($"Auth/confirm-login?clientId={clientId}", null);
    if (!response.IsSuccessStatusCode)
    {
        Console.WriteLine($"[CLIENT: {ClientId}] Login onayı API'de başarısız oldu: {response.StatusCode}");
    }
}

async Task<JobAssignmentResponse?> GetNextJobAsync()
{
    var response = await client.GetAsync("Job/next");
    
    if (response.StatusCode == System.Net.HttpStatusCode.NoContent)
    {
        return null; // İş kalmadı (204)
    }
    
    if (response.IsSuccessStatusCode)
    {
        return await response.Content.ReadFromJsonAsync<JobAssignmentResponse>();
    }
    else
    {
        Console.WriteLine($"[CLIENT: {ClientId}] İş çekme başarısız! {response.StatusCode}");
        return null;
    }
}

async Task ProcessJobAsync(JobAssignmentResponse job)
{
    // Müşteri gereksinimi: 75 saniye ile 350 saniye aralığını taklit etme
    Random random = new Random();
    int minSeconds = 75; 
    int maxSeconds = 350;
    int processingTimeMs = random.Next(minSeconds, maxSeconds + 1) * 1000;
    
    Console.WriteLine($"[CLIENT: {ClientId}] -> İŞ BAŞLADI: {job.JobId} (Mağaza: {job.StoreCode}, Barkod: {job.EanBarcode}). Süre: {processingTimeMs / 1000}s");
    
    await Task.Delay(processingTimeMs); // Mock işlem süresi
    
    // Rastgele hata oluşturma simülasyonu
    string status = "Success";
    string errorReason = null;
    
    if (random.Next(0, 100) < 15) // %15 ihtimalle Re-Login hatası
    {
        status = "Re-LoginNeeded";
        errorReason = "Windows uygulaması beklenmedik şekilde çöktü veya oturum düştü.";
        Console.WriteLine($"[CLIENT: {ClientId}] !!! HATA OLUŞTU: Yeniden Login Gerekiyor ({errorReason})");
    }
    
    // İş sonucunu API'ye bildir
    var resultRequest = new JobResultRequest
    {
        JobId = job.JobId,
        Status = status,
        ErrorReason = errorReason
    };
    
    var response = await client.PostAsJsonAsync("Job/result", resultRequest);

    if (response.IsSuccessStatusCode)
    {
        Console.WriteLine($"[CLIENT: {ClientId}] --- İŞ BİTTİ: {status} ---");
    }
    else
    {
        Console.WriteLine($"[CLIENT: {ClientId}] !!! Sonuç bildirme API'de başarısız: {response.StatusCode}");
    }
}