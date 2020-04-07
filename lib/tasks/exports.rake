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
