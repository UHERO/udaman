task :reload_aremos => :environment do
  puts ENV
  puts ENV['DATA_PATH']
  #evenaully move this to a standalone task
  CSV.open('public/rake_time.csv', 'wb') {|csv| csv << %w(name duration start end) }
  
  #this currently runs in 5 minutes even with the complete delete
  AremosSeries.delete_all
   t = Time.now
  AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/A_DATA.TSD")
  at = Time.now
  AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/S_DATA.TSD")
  st = Time.now
  AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/Q_DATA.TSD")
  qt = Time.now 
  AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/M_DATA.TSD")
  mt = Time.now
   AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/W_DATA.TSD")
   wt = Time.now
   AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/D_DATA.TSD")
   dt = Time.now
   
  puts "#{'%.2f' % (dt - t)} | to write all"
  puts "#{'%.2f' % (dt-wt)} | days"
  puts "#{'%.2f' % (wt-mt)} | weeks"
  puts "#{'%.2f' % (mt-qt)} | months"
  puts "#{'%.2f' % (qt-st)} | quarters"
  puts "#{'%.2f' % (st-at)} | half-years"
  puts "#{'%.2f' % (at-t)} | years"
  
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['reload_aremos', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end


task :reset_dependency_depth => :environment do
  t = Time.now
  DataSource.set_dependencies
  Series.assign_dependency_depth
  puts (Time.now - t).to_s + ' seconds'
end

task :reload_all_series => :environment do
  t = Time.now
  errors = Series.reload_by_dependency_depth

  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['complete series reload', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }

  #719528 is 1970-01-01 in mysql days, -10 does the adjustment for HST
  inactive_ds = DataSource.where('FROM_DAYS(719528 + (last_run_in_seconds / 3600 - 10) / 24)  < FROM_DAYS(TO_DAYS(NOW()))').order(:last_run_in_seconds)

  DataLoadMailer.series_refresh_notification(nil, inactive_ds, eval_statements.count, errors).deliver
end

task :build_rebuild => :environment do
  File.open('lib/tasks/REBUILD.rb', 'w') do |file|
    DataSource.order(:last_run_in_seconds).each do |ds|
      file.puts(ds.get_eval_statement) unless ds.series.nil?
    end
  end
end

task :reload_hiwi_series_only => :environment do
  t = Time.now
  #could also hard code this...
  hiwi_series = Series.get_all_series_from_website('hiwi.org')
  Series.reload_by_dependency_depth hiwi_series
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['hiwi series dependency check and load', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :reload_bls_series_only => :environment do
  t = Time.now
  #could also hard code this...
  bls_series = Series.get_all_series_from_website('load_from_bls')
  Series.reload_by_dependency_depth bls_series
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['bls series dependency check and load', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :reload_bea_series_only => :environment do
  t = Time.now
  #could also hard code this...
  bea_series = Series.get_all_series_from_website('bea.gov')
  Series.reload_by_dependency_depth bea_series
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['bea series dependency check and load', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :daily_history_load => :environment do
  t = Time.now
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/AgricultureForNewDB.xls"
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/Kauai.xls"
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/permits_upd.xls"
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SICDATA1.xls" #creates diffs, SIC History might be better
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SICDATA2.xls" #creates diffs for LFNS, WH, WWs etc
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SICHistory.xls" #this might fix the two above. NO DIFFS
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/hiwi_hist.xls"

  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_A_HAW.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_A_HI.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_A_HON.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_A_MAU.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_A_KAU.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_A_NBI.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_Q.xls"
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_income.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_income.xls", 'hon'
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_income.xls", 'haw'
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_income.xls", 'mau'
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_income.xls", 'kau'
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SIC_income.xls", 'hi'

  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/esic_CNTY_a.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/esic_CNTY_m.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/esic_CNTY_q.xls" 
  
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/esic_HI_a.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/esic_HI_m.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/esic_HI_q.xls" 
  
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/esic_HON_a.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/esic_HON_m.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/esic_HON_q.xls" 
  
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/tour_upd1_hist.xls" #diffs starting in 2011
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/tour_upd2_hist.xls" #diffs mostly in 2011, some in 2010. runs fast
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/tour_upd3_hist.xls" #diffs starting in 2011, some in 2012 also runs fast
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/bls_histextend_date_format_correct.xls" #Diffs for EMPLNS@HI, EMPLSA@HI, EOSNS@HON, LFNS@HI, LFSA@HI, URSA@HI, WWAFFDNS@HI, WHAFFDNS@HI, EGVNS@HON and EAFFDNS@HON (but could be from other things)
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/const_hist_m.xls" #one big diff KPPRVNR... couls be something else... not sure which is correct?
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/pc_upd_hist.xls" #2012 diffs. could probably just revisions. This one is amazingly up to date. Jimmy must be updating
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/jp_upd_a.xls" #removed the sections that get overwritten by FRED data
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/jp_upd_q.xls" #removed the sections that get overwritten by FRED data
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/jp_upd_m.xls" #removed the sections that get overwritten by FRED data
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/vexp_upd.xls"
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/seats_upd_hist.xls"
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/vday_hist.xls"
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/const_hist_q.xls"
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/const_hist_a.xls" 
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/jp_m_hist.xls"
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/bls_histextend_date_format_correct.xls", 'hiwi' #some diffs, but could be something else
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/vx_hist.xls"
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/TGBCT_hist.xls"
  
  
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/tax_hist_new.xls", 'ge' #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/tax_hist_new.xls", 'collec' #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/bls_sic_detail.xls" #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/bls_cpi_int_m.XLS" #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/inc_hist.xls", 'HI_Q' #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/inc_hist.xls", 'HI' #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/inc_hist.xls", 'HON' #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/inc_hist.xls", 'HAW' #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/inc_hist.xls", 'MAU' #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/inc_hist.xls", 'KAU' #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/SQ5NHistory.xls" #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/gsp_hist.xls" #moved up from below
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/bls_job_hist.xls" #moved up from below
  
  Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/pc_sa_hist.xls"
  #Series.load_all_series_from "#{ENV['DATA_PATH']}/rawdata/History/hbr_histQ.xls"
  
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['daily_history_load', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
  
  # ---------------------------------------------------------
end



