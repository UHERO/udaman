task :load_historical_data => :environment do 
  Series.load_historical_series_from "/Users/uhero/Documents/data/bea/update/inc_hist.xls"
  
  ["HI", "HON", "HAW", "MAU", "KAU"].each do |cnty|
    Series.load_historical_series_from "/Users/uhero/Documents/data/bea/update/inc_hist.xls", cnty
    Series.load_historical_series_from "/Users/uhero/Documents/data/bls/update/bls_hiextend.xls", cnty
    Series.load_historical_series_from "/Users/uhero/Documents/data/misc/const/update/const_hist_m.xls", cnty
  end

end
