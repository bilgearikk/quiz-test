using Raboid.Application.Interfaces;
using Raboid.Application.Interfaces.Services;

namespace Raboid.Infrastructure.Services
{
    public class SeedService : ISeedService
    {
        public async Task SeedAsync()
        {   
            Console.WriteLine("SeedService: Veritabanı başlangıç verileri oluşturuluyor...");
            await Task.Delay(1000); // Simülasyon amaçlı bekletme
            Console.WriteLine("SeedService: İşlem tamamlandı.");
        }
    }
}
