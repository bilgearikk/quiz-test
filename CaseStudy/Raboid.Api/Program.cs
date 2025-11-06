using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Raboid.Application.Interfaces.Persistence;
using Raboid.Application.Interfaces.Services;
using Raboid.Infrastructure.Persistence.Repositories;
using Raboid.Infrastructure.Services;
using Raboid.Infrastructure.Settings;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// --- 1. Konfigürasyon ve Ayarlar ---

// MongoDB Ayarlarını kaydetme
builder.Services.Configure<MongoDBSettings>(
    builder.Configuration.GetSection("MongoDBSettings"));

// --- 2. Dependency Injection (DI) Kayıtları ---

// Repository Kayıtları (Singleton)
builder.Services.AddSingleton<IJobRecordRepository, JobRecordRepository>();
builder.Services.AddSingleton<IRpaClientRepository, RpaClientRepository>();
builder.Services.AddSingleton<IBarcodePoolRepository, BarcodePoolRepository>(); 

// Servis Kayıtları (Scoped, sadece bir kez kayıt ediliyor)
builder.Services.AddScoped<ITokenService, TokenService>();
// ISeedService kayıtları çıkarıldı/birleştirildi
builder.Services.AddScoped<ISeedService, SeedService>();


// --- 3. JWT Kimlik Doğrulama Yapılandırması (Authentication) ---
var tokenKey = builder.Configuration["TokenKey"] ?? throw new ArgumentNullException("TokenKey ayarı eksik.");
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(tokenKey));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true, 
            IssuerSigningKey = key,          
            ValidateIssuer = false,          
            ValidateAudience = false         
        };
    });


// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();


var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Seed Data Mantığı (Program.cs'den tamamen kaldırıldı, çünkü manuel yüklüyoruz)
// Bu kısım boş kalmalıdır.

app.Run();