using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Raboid.Application.Interfaces.Persistence;
using System.Security.Claims;

namespace Raboid.Api.Controllers
{
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
        public string Status { get; set; } // Success, Failed, Re-LoginNeeded
        public string ErrorReason { get; set; } 
    }

    [Authorize] // Geçerli JWT gerektirir
    [Route("api/[controller]")]
    [ApiController]
    public class JobController : ControllerBase
    {
        private readonly IJobRecordRepository _jobRecordRepository;
        private readonly IRpaClientRepository _clientRepository;

        public JobController(IJobRecordRepository jobRecordRepository, IRpaClientRepository clientRepository)
        {
            _jobRecordRepository = jobRecordRepository;
            _clientRepository = clientRepository;
        }

        private string GetClientId()
        {
            // JWT'den ClientId'yi çekme
            return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        }

        [HttpGet("next")]
        public async Task<ActionResult<JobAssignmentResponse>> GetNextJob()
        {
            var clientId = GetClientId();
            if (string.IsNullOrEmpty(clientId)) return Unauthorized();

            // Atomik olarak bir sonraki hazır işi ata
            var job = await _jobRecordRepository.AssignNextReadyJobAsync(clientId);

            if (job == null)
            {
                await _clientRepository.UpdateBusyStatusAsync(clientId, false); 
                return NoContent(); // 204: İşlenecek iş kalmadı
            }
            
            // İstemciyi "Meşgul" durumuna çek
            await _clientRepository.UpdateBusyStatusAsync(clientId, true, job.Id);

            return Ok(new JobAssignmentResponse
            {
                JobId = job.Id,
                StoreCode = job.StoreCode,
                ProductCode = job.ProductCode,
                ProductName = job.ProductName,
                Price = job.Price,
                EanBarcode = job.EanBarcode
            });
        }

        [HttpPost("result")]
        public async Task<ActionResult> PostJobResult(JobResultRequest request)
        {
            var clientId = GetClientId();
            if (string.IsNullOrEmpty(clientId)) return Unauthorized();

            // İş sonucunu kaydet
            bool success = await _jobRecordRepository.UpdateJobResultAsync(
                request.JobId, 
                request.Status, 
                request.ErrorReason
            );

            if (!success)
            {
                return BadRequest("İşlem sonucu güncellenemedi veya JobId hatalı.");
            }

            // İstemciyi "Boşta" durumuna çek (Sonuç başarılı ya da hatalı fark etmez, işi bitti)
            await _clientRepository.UpdateBusyStatusAsync(clientId, false); 

            return Ok();
        }
    }
}