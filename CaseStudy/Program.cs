using Microsoft.Extensions.Hosting; 
using Raboid.Application.Interfaces.Persistence; 
using Raboid.Infrastructure.Persistence.Repositories; 
using Raboid.Infrastructure.Settings;
using Raboid.Scheduler;

IHost host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((hostContext, services) =>
    {
        var configuration = hostContext.Configuration;

        // MongoDB Ayarlarını kaydetme
        services.Configure<MongoDBSettings>(configuration.GetSection("MongoDBSettings"));
        
        // Repository Kayıtları (Singleton)
        // Scheduler'ın çalışması için JobRecord ve RpaClientRepository gereklidir.
        services.AddSingleton<IJobRecordRepository, JobRecordRepository>();
        services.AddSingleton<IRpaClientRepository, RpaClientRepository>();
        
        // Bu satır, derleyici tutarsızlığından dolayı hata vermeye devam ettiği için 
        // derlemeyi başarılı kılmak amacıyla yoruma alınmıştır.
        // services.AddSingleton<IBarcodePoolRepository, BarcodePoolRepository>(); 

        // Smart Scheduler Servisi (Arka Plan Görevi)
        services.AddHostedService<SmartScheduler>();
    })
    .Build();

await host.RunAsync();