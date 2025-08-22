task :load_cpirpp => :environment do
  ids = [
    "CUUR0000SA0", "CUURA104SA0", "CUURA210SA0", "CUURA212SA0",
    "CUURA213SA0", "CUURA214SA0", "CUURA425SA0", "CUURS11ASA0",
    "CUURS12ASA0", "CUURS12BSA0", "CUURS23ASA0", "CUURS23BSA0",
    "CUURS24ASA0", "CUURS24BSA0", "CUURS35ASA0", "CUURS35BSA0",
    "CUURS35CSA0", "CUURS35DSA0", "CUURS35ESA0", "CUURS37ASA0",
    "CUURS37BSA0", "CUURS48ASA0", "CUURS48BSA0", "CUURS49ASA0",
    "CUURS49BSA0", "CUURS49CSA0", "CUURS49DSA0", "CUURS49ESA0",
    "CUURS49FSA0", "CUURS49GSA0"
  ]
  ids.concat(ids.map { |s| s.sub("CUUR", "CUUS") })

  all_series = []
  ids.each do |id|
    all_series.concat(Series.search("^#{id} ~#{id}"))
  end

  # also gets cpiu_...i
  all_series.concat(Series.search("^CPIU_"))
  all_series.concat(Series.search("^CPIRPP_"))
  all_series.concat(Series.search("^SBSCPIRPP_"))

  raise "too many series" unless all_series.length < 500

  all_ds = []
  all_series.each do |s|
    all_ds.concat(s.data_sources)
  end

  all_ds.each do |ds|
    next if ds.eval.include?("Series.load_api_bls_NEW")
    ds.reload_source
  end
end
