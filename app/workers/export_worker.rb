## Export TSD format files and sync up to both production and Mac mini
class ExportWorker
  include Sidekiq::Worker
  sidekiq_options queue: :critical

  def perform
    Series.run_tsd_exports

    local_dir = File.join(ENV['DATA_PATH'], 'udaman_tsd/')       ## final slash on source dir name is needed
    prod_location = 'uhero@uhero1.colo.hawaii.edu:' + local_dir  ## assumes DATA_PATH is same on both, but this is probly safe
    ## Domain name "macmini" is defined in /etc/hosts - change there if need be
    mini_location = 'uhero@macmini:/Volumes/UHERO/UHEROwork/MacMiniData/udaman_tsd'
    unless system("rsync -r #{local_dir} #{mini_location}")
      raise "Could not copy contents of #{local_dir} directory to Mac mini server"
    end
    unless system("rsync -r #{local_dir} #{prod_location}")
      raise "Could not copy contents of #{local_dir} directory to production server"
    end
  end
end
