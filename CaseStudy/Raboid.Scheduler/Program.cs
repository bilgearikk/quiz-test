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
        services.AddSingleton<IJobRecordRepository, JobRecordRepository>();
        services.AddSingleton<IRpaClientRepository, RpaClientRepository>();
        services.AddSingleton<IBarcodePoolRepository, BarcodePoolRepository>();

        // Smart Scheduler Servisi
        services.AddHostedService<SmartScheduler>();
    })
    .Build();

await host.RunAsync();