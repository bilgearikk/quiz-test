namespace Raboid.Infrastructure.Settings
{
    public class MongoDBSettings
    {
        public string ConnectionString { get; set; }
        public string DatabaseName { get; set; }
        public string JobRecordsCollectionName { get; set; }
        public string RpaClientsCollectionName { get; set; }
        public string BarcodePoolsCollectionName { get; set; }
    }
}