task :aremos_exports => :environment do
  t = Time.now
  #TOUR
  DataList.write 'tour1', "#{ENV['DATA_PATH']}/udaman/tour1_UDA.xls" #8.9s
  DataList.write 'tour2', "#{ENV['DATA_PATH']}/udaman/tour2_UDA.xls" #9.2s
  DataList.write 'tour3', "#{ENV['DATA_PATH']}/udaman/tour3_UDA.xls" #6.7s
  DataList.write 'tour_vrls', "#{ENV['DATA_PATH']}/udaman/tour_vrls_UDA.xls" #6.7s
  DataList.write 'tour_ocup', "#{ENV['DATA_PATH']}/udaman/ocup_UDA.xls"
  DataList.write 'tour_vso', "#{ENV['DATA_PATH']}/udaman/vso_UDA.xls"
  
  #BLS
  DataList.write 'bls_job_m', "#{ENV['DATA_PATH']}/udaman/bls_job_m_UDA.xls" #25.5
  
  #pseudo spline
  DataList.write 'famsize_q', "#{ENV['DATA_PATH']}/udaman/famsize_q.xls" #3.15
  DataList.write 'famsize_a', "#{ENV['DATA_PATH']}/udaman/famsize_a.xls" #0.63

  #MISC
  DataList.write 'const', "#{ENV['DATA_PATH']}/udaman/const.xls" #2.23

  
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['aremos_exports', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :tsd_exports => :environment do
  ExportWorker.perform_async
end

### Do we really still need this? What was the compelling reason for introducing it in the first place?
task :categories_backup => :environment do
  misc_dir = File.join(ENV['DATA_PATH'], 'misc')
  new_dump = File.join(misc_dir, 'new_dump.sql')
  latest = File.join(misc_dir, 'latest_categories.sql')
  unless system(%Q{rm -f #{new_dump}; mysqldump -u$DB_USER -p$DB_PASSWORD -h$DB_HOST uhero_db_dev categories | sed 's/),(/),\\n\\/*INSERT*\\/(/g' > #{new_dump}})
    Rails.logger.warn "Categories_backup task: mysqldump fail: #{$?.to_s}"
    return
  end
  cats_have_changed = !system(%Q{bash -c 'diff <(grep INSERT #{latest}) <(grep INSERT #{new_dump}) > /dev/null 2>&1'})
  if cats_have_changed
    prev_latest = File.join(misc_dir, 'prev_latest_categories.sql')
    File.rename(prev_latest, File.join(misc_dir, 'prev_prev_latest_categories.sql')) rescue ''
    File.rename(latest, prev_latest) rescue ''
    File.rename(new_dump, latest) rescue ''
  end
end
