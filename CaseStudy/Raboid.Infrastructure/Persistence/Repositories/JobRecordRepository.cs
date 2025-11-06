using MongoDB.Driver;
using Microsoft.Extensions.Options;
using Raboid.Application.Interfaces.Persistence;
using Raboid.Domain.Entities;
using Raboid.Infrastructure.Settings;

namespace Raboid.Infrastructure.Persistence.Repositories
{
    public class JobRecordRepository : IJobRecordRepository
    {
        private readonly IMongoCollection<JobRecord> _jobRecordCollection;

        public JobRecordRepository(IOptions<MongoDBSettings> dbSettings)
        {
            var mongoClient = new MongoClient(dbSettings.Value.ConnectionString);
            var mongoDatabase = mongoClient.GetDatabase(dbSettings.Value.DatabaseName);
            
            _jobRecordCollection = mongoDatabase.GetCollection<JobRecord>(
                dbSettings.Value.JobRecordsCollectionName);
        }

        public async Task<JobRecord> AssignNextReadyJobAsync(string clientId)
        {
            // Filtre: Durumu 'Ready' olan herhangi bir işi bul.
            var filter = Builders<JobRecord>.Filter.Eq(j => j.Status, "Ready");
            
            var update = Builders<JobRecord>.Update
                .Set(j => j.Status, "Assigned")
                .Set(j => j.AssignedRpaClientId, clientId)
                .Set(j => j.AssignmentTime, DateTime.UtcNow);

            // FindOneAndUpdateAsync atomik işlemi, concurrency'yi çözer.
            return await _jobRecordCollection.FindOneAndUpdateAsync(
                filter, 
                update,
                new FindOneAndUpdateOptions<JobRecord>
                {
                    IsUpsert = false, 
                    ReturnDocument = ReturnDocument.After 
                });
        }

        public async Task<bool> UpdateJobResultAsync(string jobId, string status, string errorReason = null)
        {
            var filter = Builders<JobRecord>.Filter.Eq(j => j.Id, jobId);
            
            var update = Builders<JobRecord>.Update
                .Set(j => j.Status, status)
                .Set(j => j.CompletionTime, DateTime.UtcNow)
                .Set(j => j.ErrorReason, errorReason ?? string.Empty);

            if (status == "Failed" || status == "Re-LoginNeeded")
            {
                update = update.Inc(j => j.RetryCount, 1);
            }

            var result = await _jobRecordCollection.UpdateOneAsync(filter, update);
            return result.IsAcknowledged && result.ModifiedCount > 0;
        }

        public async Task<int> UnassignExpiredJobsAsync(string clientId)
        {
            // Hatalı/Expire olan RPA istemcisine atanmış işleri Ready'ye çekme
            var filter = Builders<JobRecord>.Filter.Where(j => 
                j.AssignedRpaClientId == clientId && j.Status == "Assigned");
            
            var update = Builders<JobRecord>.Update
                .Set(j => j.Status, "Ready")
                .Set(j => j.AssignedRpaClientId, null)
                .Set(j => j.AssignmentTime, null);

            var result = await _jobRecordCollection.UpdateManyAsync(filter, update);
            return (int)result.ModifiedCount;
        }

        public async Task CreateManyAsync(IEnumerable<JobRecord> records)
        {
            await _jobRecordCollection.InsertManyAsync(records);
        }
    }
}