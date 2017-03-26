# Convert xlsx files to csv format
require 'sidekiq'
require 'redis'

class XlsCsvWorker
  include Sidekiq::Worker
  sidekiq_options queue: 'critical'

  def perform(dbu_id, which)
    begin
      dbu = DbedtUpload.find(dbu_id)
      if dbu.nil?
        puts "No DBEDT Upload with id = #{dbu_id}"
        return
      end
      xls_path = dbu.absolute_path(which)
      csv_path = xls_path.change_file_extension('csv')
      if !File.exists?(xls_path) && !system("rsync -t #{ENV['OTHER_WORKER']}:#{xls_path} /data/dbedt_files")
        puts "Could not get xlsx file ((#{xls_path}) #{dbu_id}:#{which}) from $OTHER_WORKER: #{ENV['OTHER_WORKER']}"
        dbu.set_status(which, :fail)
        return
      end
    end
    unless system "xlsx2csv.py -s 1 -d tab -c utf-8  #{xls_path} #{csv_path}"
      puts "Could not transform xlsx to csv (#{dbu_id}:#{which})"
      dbu.set_status(which, :fail)
      return
    end
    if !ENV['OTHER_WORKER'].nil? && !system("rsync -t #{csv_path} #{ENV['OTHER_WORKER']}:/data/dbedt_files")
      puts "Could not copy #{csv_path} for #{dbu_id} to $OTHER_WORKER: #{ENV['OTHER_WORKER']}"
      dbu.set_status(which, :fail)
      return
    end
    dbu.load_csv(which)
    dbu.set_status(which, :ok)
  rescue => error
    puts error.message
    puts error.backtrace
    dbu.set_status(which, :fail)
  end
end
