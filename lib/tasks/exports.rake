task :tsd_exports => :environment do
  ExportWorker.perform_async
end
