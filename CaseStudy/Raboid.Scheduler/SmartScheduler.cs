using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Raboid.Application.Interfaces.Persistence;
using Raboid.Domain.Entities;

namespace Raboid.Scheduler
{
    // Ayar POCO'su
    public class SchedulerSettings
    {
        public int CheckIntervalSeconds { get; set; }
        public int LoginTimeoutMinutes { get; set; }
    }

    public class SmartScheduler : BackgroundService
    {
        private readonly ILogger<SmartScheduler> _logger;
        private readonly IServiceProvider _serviceProvider;
        private readonly SchedulerSettings _settings;

        public SmartScheduler(ILogger<SmartScheduler> logger, IServiceProvider serviceProvider, IConfiguration config)
        {
            _logger = logger;
            _serviceProvider = serviceProvider;
            
            // Ayarları oku
            _settings = config.GetSection("SchedulerSettings").Get<SchedulerSettings>();
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Smart Scheduler başlıyor. Kontrol Aralığı: {Interval}s", _settings.CheckIntervalSeconds);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Yeni Scope ile servisleri al
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var jobRepo = scope.ServiceProvider.GetRequiredService<IJobRecordRepository>();
                        var clientRepo = scope.ServiceProvider.GetRequiredService<IRpaClientRepository>();

                        await ManageClientLogins(clientRepo, jobRepo);
                        // DistributeJobs mantığı, artık ManageClientLogins içinde dolaylı olarak yönetiliyor.
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Scheduler mantığında kritik hata oluştu.");
                }

                await Task.Delay(TimeSpan.FromSeconds(_settings.CheckIntervalSeconds), stoppingToken);
            }
            _logger.LogInformation("Smart Scheduler durduruldu.");
        }

        // Oturum Yönetimi: Login zaman aşımlarını ve Expired durumlarını ele alır.
        private async Task ManageClientLogins(IRpaClientRepository clientRepo, IJobRecordRepository jobRepo)
        {
            var clients = await clientRepo.GetAllClientsAsync();
            var timeout = TimeSpan.FromMinutes(_settings.LoginTimeoutMinutes);

            foreach (var client in clients)
            {
                // A1: LoggingIn Timeout Kontrolü (1 dakikadan fazla süren login denemeleri)
                if (client.LoginStatus == "LoggingIn" && client.LastLoginAttempt.HasValue &&
                    (DateTime.UtcNow - client.LastLoginAttempt.Value) > timeout)
                {
                    _logger.LogWarning($"RPA Client {client.ClientId} login zaman aşımına uğradı ({client.LastLoginAttempt.Value}). Durum Expired yapılıyor.");
                    await clientRepo.UpdateLoginStatusAsync(client.ClientId, "Expired");
                }
                
                // A2: Expired Durum Yönetimi (Hem Timeout hem de MockClient'tan gelen Re-LoginNeeded)
                if (client.LoginStatus == "Expired")
                {
                    // İşleri geri Ready durumuna çek:
                    var unassignedCount = await jobRepo.UnassignExpiredJobsAsync(client.ClientId);
                    
                    if(unassignedCount > 0)
                        _logger.LogInformation($"{client.ClientId} istemcisinden {unassignedCount} iş geri alındı ve Ready yapıldı.");

                    // İstemciyi tekrar login olmaya zorlamak için durumu Ready olarak API'de ayarlıyoruz.
                    // Bu Client, tekrar login endpoint'ini çağırmalıdır.
                }
            }
        }
    }
}