using MongoDB.Driver;
using Microsoft.Extensions.Options;
using Raboid.Application.Interfaces.Persistence;
using Raboid.Domain.Entities;
using Raboid.Infrastructure.Settings;

namespace Raboid.Infrastructure.Persistence.Repositories
{
    public class RpaClientRepository : IRpaClientRepository
    {
        private readonly IMongoCollection<RpaClient> _rpaClientCollection;

        public RpaClientRepository(IOptions<MongoDBSettings> dbSettings)
        {
            var mongoClient = new MongoClient(dbSettings.Value.ConnectionString);
            var mongoDatabase = mongoClient.GetDatabase(dbSettings.Value.DatabaseName);
            
            _rpaClientCollection = mongoDatabase.GetCollection<RpaClient>(
                dbSettings.Value.RpaClientsCollectionName);
        }

        public async Task<RpaClient> GetClientByCredentialsAsync(string clientId, string clientSecret)
        {
            // API'nin başlangıcında koleksiyon boşsa hata vermesini önlemek için güvenli filtre
            var filter = Builders<RpaClient>.Filter.Where(c => 
                c.ClientId == clientId && c.ClientSecret == clientSecret);
            
            // Find yerine Find.FirstOrDefaultAsync() kullanıyoruz.
            var client = await _rpaClientCollection.Find(filter).FirstOrDefaultAsync();

            // Null kontrolü ile güvenli dönüş
            return client; 
        }

        public async Task<bool> UpdateLoginStatusAsync(string clientId, string status, string sessionId = null)
        {
            var filter = Builders<RpaClient>.Filter.Eq(c => c.ClientId, clientId);
            
            var update = Builders<RpaClient>.Update
                .Set(c => c.LoginStatus, status)
                .Set(c => c.LastLoginAttempt, DateTime.UtcNow);

            if (!string.IsNullOrEmpty(sessionId))
            {
                update = update.Set(c => c.WindowsSessionId, sessionId);
            }

            var result = await _rpaClientCollection.UpdateOneAsync(filter, update);
            return result.IsAcknowledged && result.ModifiedCount > 0;
        }

        public async Task<bool> UpdateBusyStatusAsync(string clientId, bool isBusy, string jobId = null)
        {
            var filter = Builders<RpaClient>.Filter.Eq(c => c.ClientId, clientId);
            
            var update = Builders<RpaClient>.Update
                .Set(c => c.IsBusy, isBusy)
                .Set(c => c.CurrentJobId, jobId);
            
            var result = await _rpaClientCollection.UpdateOneAsync(filter, update);
            return result.IsAcknowledged && result.ModifiedCount > 0;
        }

        public async Task<List<RpaClient>> GetAllClientsAsync()
        {
            return await _rpaClientCollection.Find(_ => true).ToListAsync();
        }
    }
}