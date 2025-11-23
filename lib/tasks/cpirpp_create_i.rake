## Q and A were left out of the original script for some reason. Adding them here.
## Merge the two tasks before using this on prod.
task :create_cpirpp_i => :environment do
  regions = [
    "U.S. city average", "Pittsburgh, PA", "Cleveland-Akron, OH",
    "Milwaukee-Racine, WI", "Cincinnati-Hamilton, OH-KY-IN",
    "Kansas City, MO-KS", "Portland-Salem, OR-WA",
    "Boston-Cambridge-Newton, MA-NH",
    "New York-Newark-Jersey City, NY-NJ-PA",
    "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD",
    "Chicago-Naperville-Elgin, IL-IN-WI",
    "Detroit-Warren-Dearborn, MI",
    "Minneapolis-St.Paul-Bloomington, MN-WI",
    "St. Louis, MO-IL",
    "Washington-Arlington-Alexandria, DC-VA-MD-WV",
    "Miami-Fort Lauderdale-West Palm Beach, FL",
    "Atlanta-Sandy Springs-Roswell, GA",
    "Tampa-St. Petersburg-Clearwater, FL",
    "Baltimore-Columbia-Towson, MD",
    "Dallas-Fort Worth-Arlington, TX",
    "Houston-The Woodlands-Sugar Land, TX",
    "Phoenix-Mesa-Scottsdale, AZ",
    "Denver-Aurora-Lakewood, CO",
    "Los Angeles-Long Beach-Anaheim, CA",
    "San Francisco-Oakland-Hayward, CA",
    "Riverside-San Bernardino-Ontario, CA",
    "Seattle-Tacoma-Bellevue WA",
    "San Diego-Carlsbad, CA",
    "Urban Hawaii",
    "Urban Alaska"
  ]

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

  name_ids = ids.map { |id| id.sub(/\ACUUR/, '').sub(/SA0\z/, '') }

  testing_prefix = ""

  # SBS quarterly and annual aggregate FOR INTERPOLATED VERSIONS
  # same name as above save for frequency, but aggregating from interpolated monthly data
  # this is quarterly INTERPOLATED
  ids.each_with_index do |id, idx|
    unit_id = "129"
    bls_source_id = "2"
    us_geo_id = "7"
    hi_geo_id = "1"
    in_hawaii = regions[idx] == "Urban Hawaii"
    geo_id = regions[idx] != "Urban Hawaii" ? us_geo_id : hi_geo_id

    # set up series attrs
    name_id = name_ids[idx]
    name_parts = {
      :prefix => "#{testing_prefix}SBSCPIRPP_#{name_id}I",
      :geography_id => geo_id,
      :freq => "Q"
    }
    xs_attrs = {
      :percent => "false",
      :real => "",
      :seasonal_adjustment => "not_seasonally_adjusted",
      :frequency_transform => "average",
      :restricted => "false"
    }
    series_attrs = {
      :xseries_attributes => xs_attrs,
      :name_parts => name_parts,
      :dataPortalName => "CPIRPP INTERPOLATED AGGREGATED #{regions[idx]}",
      :description => "",
      :unit_id => unit_id,
      :source_id => bls_source_id,
      :source_link => "",
      :source_detail_id => "",
      :investigation_notes => "",
      :decimals => "1",
      :universe => "UHERO",
      :add2meas => ""
    }

    # create series
    s = Series.create_new(series_attrs)

    # set up load statement - aggregate from INTERPOLATED monthly series
    name_id = name_ids[idx]
    eval_str = "#{testing_prefix}SBSCPIRPP_#{name_id}I@#{in_hawaii ? "HI" : "US"}.M"
    eval_str = "\"#{eval_str}\".ts.aggregate(:quarter, :average)"
    ds_attrs = {
      :eval => eval_str,
      :priority => 50,
      :scale => "1.0",
      :presave_hook => nil,
      :clear_before_load => false,
      :pseudo_history => false,
      :universe => "UHERO",
    }

    # create ds
    ds = s.data_sources.create!(ds_attrs)
    ds.setup
  end

  # this is annual INTERPOLATED
  ids.each_with_index do |id, idx|
    unit_id = "129"
    bls_source_id = "2"
    us_geo_id = "7"
    hi_geo_id = "1"
    in_hawaii = regions[idx] == "Urban Hawaii"
    geo_id = regions[idx] != "Urban Hawaii" ? us_geo_id : hi_geo_id

    # set up series attrs
    name_id = name_ids[idx]
    name_parts = {
      :prefix => "#{testing_prefix}SBSCPIRPP_#{name_id}I",
      :geography_id => geo_id,
      :freq => "A"
    }
    xs_attrs = {
      :percent => "false",
      :real => "",
      :seasonal_adjustment => "not_seasonally_adjusted",
      :frequency_transform => "average",
      :restricted => "false"
    }
    series_attrs = {
      :xseries_attributes => xs_attrs,
      :name_parts => name_parts,
      :dataPortalName => "CPIRPP INTERPOLATED AGGREGATED #{regions[idx]}",
      :description => "",
      :unit_id => unit_id,
      :source_id => bls_source_id,
      :source_link => "",
      :source_detail_id => "",
      :investigation_notes => "",
      :decimals => "1",
      :universe => "UHERO",
      :add2meas => ""
    }

    # create series
    s = Series.create_new(series_attrs)

    # set up load statement - aggregate from INTERPOLATED monthly series
    name_id = name_ids[idx]
    eval_str = "#{testing_prefix}SBSCPIRPP_#{name_id}I@#{in_hawaii ? "HI" : "US"}.M"
    eval_str = "\"#{eval_str}\".ts.aggregate(:year, :average)"
    ds_attrs = {
      :eval => eval_str,
      :priority => 50,
      :scale => "1.0",
      :presave_hook => nil,
      :clear_before_load => false,
      :pseudo_history => false,
      :universe => "UHERO",
    }

    # create ds
    ds = s.data_sources.create!(ds_attrs)
    ds.setup
  end
end
