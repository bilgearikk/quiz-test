using Raboid.Domain.Entities;

namespace Raboid.Application.Interfaces.Persistence
{
    public interface IJobRecordRepository
    {
        Task<JobRecord> AssignNextReadyJobAsync(string clientId); 
        Task<bool> UpdateJobResultAsync(string jobId, string status, string errorReason = null);
        Task<int> UnassignExpiredJobsAsync(string clientId);
        Task CreateManyAsync(IEnumerable<JobRecord> records);
    }
}