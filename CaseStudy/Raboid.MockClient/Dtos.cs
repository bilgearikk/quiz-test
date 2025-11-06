// DTO Sınıf Tanımları
// Program.cs'deki Top-Level Statements hatasını çözmek için buraya taşındı.

public class AuthRequest
{
    public string ClientId { get; set; }
    public string ClientSecret { get; set; }
}

public class JobAssignmentResponse
{
    public string JobId { get; set; }
    public string StoreCode { get; set; }
    public string ProductCode { get; set; }
    public string ProductName { get; set; }
    public decimal Price { get; set; }
    public string EanBarcode { get; set; }
}

public class JobResultRequest
{
    public string JobId { get; set; }
    public string Status { get; set; } 
    public string ErrorReason { get; set; } 
}