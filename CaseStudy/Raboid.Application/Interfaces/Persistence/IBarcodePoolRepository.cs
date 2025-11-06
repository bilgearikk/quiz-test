using Raboid.Domain.Entities;

namespace Raboid.Application.Interfaces.Persistence
{
    public interface IBarcodePoolRepository
    {
        /// <summary>
        /// Barkod havuzundan bir sonraki kullanılabilir EAN-13 barkodunu atomik olarak çeker.
        /// </summary>
        /// <returns>Eşsiz barkod string'i veya havuz bittiyse null.</returns>
        Task<string> GetNextBarcodeAtomicallyAsync(); 
        
        /// <summary>
        /// Gün başında barkod aralığını sisteme yükler.
        /// </summary>
        Task CreatePoolAsync(BarcodePool pool);
    }
}