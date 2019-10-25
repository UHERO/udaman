## Export TSD format files and sync up to both production and Mac mini
class ExportWorker
  include Sidekiq::Worker
  sidekiq_options queue: :critical

  def perform
    ## This code assumes DATA_PATH is the same on both prod and worker, but this is probly a safe bet
    banks_path = File.join(ENV['DATA_PATH'], 'BnkLists')
    ## Hostname alias "macmini" is defined in /etc/hosts - change there if necessary
    unless system("rsync -r --del uhero@macmini:/Volumes/UHERO/UHEROwork/MacMiniData/BnkLists/ #{banks_path}")
      raise "Could not copy contents of #{banks_path} directory from Mac mini to local #{banks_path}"
    end

    Series.run_tsd_exports

    local_dir = File.join(ENV['DATA_PATH'], 'udaman_tsd/')   ## final slash on dir name is needed
    prod_location = 'uhero@uhero1.colo.hawaii.edu:' + local_dir
#    mini_location = 'uhero@macmini:/Volumes/UHERO/UHEROwork/MacMiniData/udaman_tsd'
#    unless system("rsync -r #{local_dir} #{mini_location}")
#      raise "Could not copy contents of #{local_dir} directory to Mac mini server"
#    end
    unless system("rsync -r #{local_dir} #{prod_location}")
      raise "Could not copy contents of #{local_dir} directory to production server"
    end
  end
end
