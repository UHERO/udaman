task :load_historical_data => :environment do 
  Series.load_historical_series_from "#{ENV['DATA_PATH']}/bea/update/inc_hist.xls"
  
  ["HI", "HON", "HAW", "MAU", "KAU"].each do |cnty|
    Series.load_historical_series_from "#{ENV['DATA_PATH']}/bea/update/inc_hist.xls", cnty
    Series.load_historical_series_from "#{ENV['DATA_PATH']}/bls/update/bls_hiextend.xls", cnty
    Series.load_historical_series_from "#{ENV['DATA_PATH']}/misc/const/update/const_hist_m.xls", cnty
  end

end
