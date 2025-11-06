using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Raboid.Domain.Entities
{
    public class BarcodePool
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; }

        public string StartBarcode { get; set; }
        public string EndBarcode { get; set; }
        
        // Atanması beklenen bir sonraki barkodu tutan alan.
        public string CurrentNextBarcode { get; set; } 
        public bool IsExhausted { get; set; }
    }
}