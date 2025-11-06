using MongoDB.Driver;
using Microsoft.Extensions.Options;
using Raboid.Application.Interfaces.Persistence;
using Raboid.Domain.Entities;
using Raboid.Infrastructure.Settings;
using System.Threading.Tasks;

namespace Raboid.Infrastructure.Persistence.Repositories
{
    public class BarcodePoolRepository : IBarcodePoolRepository
    {
        private readonly IMongoCollection<BarcodePool> _barcodePoolCollection;

        public BarcodePoolRepository(IOptions<MongoDBSettings> dbSettings)
        {
            var mongoClient = new MongoClient(dbSettings.Value.ConnectionString);
            var mongoDatabase = mongoClient.GetDatabase(dbSettings.Value.DatabaseName);
            
            _barcodePoolCollection = mongoDatabase.GetCollection<BarcodePool>(
                dbSettings.Value.BarcodePoolsCollectionName);
        }

        public async Task CreatePoolAsync(BarcodePool pool)
        {
            await _barcodePoolCollection.InsertOneAsync(pool);
        }

        public async Task<string?> GetNextBarcodeAtomicallyAsync()
        {
            // Havuzu tükenmemiş olan bir kaydı bul
            var filter = Builders<BarcodePool>.Filter.Eq(x => x.IsExhausted, false);

            // Havuzdan bir kayıt seç (değişiklik yapmadan sadece çek)
            var pool = await _barcodePoolCollection.FindOneAndUpdateAsync(
                filter,
                Builders<BarcodePool>.Update.Combine(), // Boş update = değişiklik yok
                new FindOneAndUpdateOptions<BarcodePool>
                {
                    ReturnDocument = ReturnDocument.Before,
                    Sort = Builders<BarcodePool>.Sort.Ascending(x => x.Id)
                }
            );

            if (pool == null)
                return null; // Havuz kalmadıysa null dön

            var currentBarcode = pool.CurrentNextBarcode;

            if (currentBarcode == pool.EndBarcode)
            {
                // Havuz tükendi
                await _barcodePoolCollection.UpdateOneAsync(
                    x => x.Id == pool.Id,
                    Builders<BarcodePool>.Update.Set(x => x.IsExhausted, true));
                return null;
            }

            // String’i sayıya çevirip 1 artır
            if (!long.TryParse(currentBarcode, out var currentNumber))
                throw new FormatException($"Geçersiz barkod formatı: {currentBarcode}");

            var nextNumber = currentNumber + 1;
            var nextBarcode = nextNumber.ToString().PadLeft(currentBarcode.Length, '0');

            // Güncel barkodu kaydet
            await _barcodePoolCollection.UpdateOneAsync(
                x => x.Id == pool.Id,
                Builders<BarcodePool>.Update.Set(x => x.CurrentNextBarcode, nextBarcode));

            return nextBarcode;
        }
    }
}
