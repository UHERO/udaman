task :create_cpirpp => :environment do
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

  rf_cities = [
    0.417840679, 0.385057434, 0.42152706, 0.418443609, 0.417405978,
    0.425860524, 0.455761046, 0.440655207, 0.466245543, 0.423925481,
    0.459835999, 0.428915603, 0.445398496, 0.414216437, 0.472176544,
    0.45549149, 0.424919733, 0.461900487, 0.451446342, 0.452415485,
    0.461475524, 0.755747737, 0.457654072, 0.497537512, 0.529636358,
    0.984993581, 0.452750061, 0.458314196, 0.477363729, 0.508876135
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

  def make_base_series(ids, regions)
    # following values should be consistent across series
    unit_id = "129"
    bls_source_id = "2"
    bls_interp_source_id = "29"
    us_geo_id = "7"
    hi_geo_id = "1"

    testing_prefix = ""

    # old series that end before the last decade
    old_series = %w[
      CUURA104SA0
      CUURA212SA0
      CUURA213SA0
      CUURA214SA0
      CUURA425SA0
    ]

    # load statement templates
    load_statement_template = "Series.load_api_bls_NEW(\"xxxx\", \"yyyy\")"
    csv_load_statement_template = "\"xxxx\".tsn.load_from(\"rparsed/cpirpp.csv\")"

    ids.each_with_index do |id, idx|
      # next if idx == 0  # skip city avg

      geo_id = regions[idx] != "Urban Hawaii" ? us_geo_id : hi_geo_id

      # set up series attrs
      name_parts = {
        :prefix => "#{testing_prefix}#{id}",
        :geography_id => geo_id,
        :freq => id.start_with?("CUUR") ? "M" : "S"
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
        :dataPortalName => "BASE #{regions[idx]}",
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

      # set up load statement
      eval_str = load_statement_template.sub "xxxx", id
      eval_str = eval_str.sub "yyyy", id.start_with?("CUUR") ? "M" : "S"
      ds_attrs = {
        :eval => eval_str,
        :priority => 60,
        :scale => "1.0",
        :presave_hook => nil,
        :clear_before_load => false,
        :pseudo_history => false,
        :universe => "UHERO",
      }

      # create ds
      ds = s.data_sources.create!(ds_attrs)
      ds.setup
      # skip series that ended decades ago and have no new data points
      if old_series.include?(id)
        ds.update!(disabled: true, last_error: nil, last_error_at: nil)
      end

      # part 2 (the historical data csv)
      # set up load statement
      eval_str = csv_load_statement_template.sub "xxxx", s.name
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

  # make base monthly and semiannual series
  make_base_series(ids, regions)
  make_base_series(ids.map { |id| id.start_with?("CUUR") ? id.sub("CUUR", "CUUS") : id }, regions)

  # make combined series
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
      :prefix => "#{testing_prefix}CPIU_#{name_id}",
      :geography_id => geo_id,
      :freq => "M"
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
      :dataPortalName => "JOINED #{regions[idx]}",
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

    # set up load statement
    # monthly series
    eval_str = "#{testing_prefix}#{id}@#{in_hawaii ? "HI" : "US"}.M"
    eval_str = "\"#{eval_str}\".ts"
    ds_attrs = {
      :eval => eval_str,
      :priority => 60,
      :scale => "1.0",
      :presave_hook => nil,
      :clear_before_load => false,
      :pseudo_history => false,
      :universe => "UHERO",
    }

    # create ds
    ds = s.data_sources.create!(ds_attrs)
    ds.setup

    # part 2 (semi annual)
    # set up load statement
    semi_id = id.start_with?("CUUR") ? id.sub("CUUR", "CUUS") : id
    eval_str = "#{testing_prefix}#{semi_id}@#{in_hawaii ? "HI" : "US"}.S"
    eval_str = "\"#{eval_str}\".ts"
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

  # interpolate these
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
      :prefix => "#{testing_prefix}CPIU_#{name_id}I",
      :geography_id => geo_id,
      :freq => "M"
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
      :dataPortalName => "CPI-U INTERPOLATED #{regions[idx]}",
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

    # set up load statement
    name_id = name_ids[idx]
    eval_str = "#{testing_prefix}CPIU_#{name_id}@#{in_hawaii ? "HI" : "US"}.M"
    eval_str = "\"#{eval_str}\".ts.fill_missing_months_linear"
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

  # aggregate series
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
      :prefix => "#{testing_prefix}CPIU_#{name_id}A",
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
      :dataPortalName => "AGGREGATED #{regions[idx]}",
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

    # set up load statement
    name_id = name_ids[idx]
    eval_str = "#{testing_prefix}CPIU_#{name_id}I@#{in_hawaii ? "HI" : "US"}.M"
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

  # for annual now
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
      :prefix => "#{testing_prefix}CPIU_#{name_id}A",
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
      :dataPortalName => "INTERPOLATED #{regions[idx]}",
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

    # set up load statement
    name_id = name_ids[idx]
    eval_str = "#{testing_prefix}CPIU_#{name_id}I@#{in_hawaii ? "HI" : "US"}.M"
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

  # multiply series by rf
  ids.each_with_index do |id, idx|
    unit_id = "129"
    bls_source_id = "2"
    us_geo_id = "7"
    hi_geo_id = "1"
    geo_id = regions[idx] != "Urban Hawaii" ? us_geo_id : hi_geo_id

    # set up series attrs
    name_id = name_ids[idx]
    name_parts = {
      :prefix => "#{testing_prefix}CPIRPP_#{name_id}I",
      :geography_id => geo_id,
      :freq => "M"
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
      :dataPortalName => "CALC #{regions[idx]}",
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

    # set up load statement
    in_hawaii = regions[idx] == "Urban Hawaii"
    name_id = name_ids[idx]
    eval_str = "#{testing_prefix}CPIU_#{name_id}I@#{in_hawaii ? "HI" : "US"}.M"
    eval_str = "\"#{eval_str}\".ts * #{rf_cities[idx]}"
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

  # divide by cpi us
  ids.each_with_index do |id, idx|
    # next if idx == 0  # skip us

    unit_id = "129"
    bls_source_id = "2"
    us_geo_id = "7"
    hi_geo_id = "1"
    is_hawaii = regions[idx] == "Urban Hawaii"
    geo_id = regions[idx] != "Urban Hawaii" ? us_geo_id : hi_geo_id

    # set up series attrs
    name_id = name_ids[idx]
    name_parts = {
      :prefix => "#{testing_prefix}SBSCPIRPP_#{name_id}I",
      :geography_id => geo_id,
      :freq => "M"
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
      :dataPortalName => "#{regions[idx]}",
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

    # set up load statement
    cpi_us_series = "#{testing_prefix}CPIRPP_#{name_ids[0]}I@US.M"
    eval_str = "#{testing_prefix}CPIRPP_#{name_id}I@#{is_hawaii ? "HI" : "US"}.M"
    eval_str = "((\"#{eval_str}\".ts) / (\"#{cpi_us_series}\".ts)) * 100"
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


  ###
  # this is the cpirpp for non interp
  # multiply series by rf
  ids.each_with_index do |id, idx|
    unit_id = "129"
    bls_source_id = "2"
    us_geo_id = "7"
    hi_geo_id = "1"
    geo_id = regions[idx] != "Urban Hawaii" ? us_geo_id : hi_geo_id

    # set up series attrs
    name_id = name_ids[idx]
    name_parts = {
      :prefix => "#{testing_prefix}CPIRPP_#{name_id}",
      :geography_id => geo_id,
      :freq => "M"
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
      :dataPortalName => "CALC #{regions[idx]}",
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

    # set up load statement
    in_hawaii = regions[idx] == "Urban Hawaii"
    name_id = name_ids[idx]
    eval_str = "#{testing_prefix}CPIU_#{name_id}@#{in_hawaii ? "HI" : "US"}.M"
    eval_str = "\"#{eval_str}\".ts * #{rf_cities[idx]}"
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

  # divide by cpi us
  ids.each_with_index do |id, idx|
    # next if idx == 0  # skip us

    unit_id = "129"
    bls_source_id = "2"
    us_geo_id = "7"
    hi_geo_id = "1"
    is_hawaii = regions[idx] == "Urban Hawaii"
    geo_id = regions[idx] != "Urban Hawaii" ? us_geo_id : hi_geo_id

    # set up series attrs
    name_id = name_ids[idx]
    name_parts = {
      :prefix => "#{testing_prefix}SBSCPIRPP_#{name_id}",
      :geography_id => geo_id,
      :freq => "M"
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
      :dataPortalName => "#{regions[idx]}",
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

    # set up load statement
    cpi_us_series = "#{testing_prefix}CPIRPP_#{name_ids[0]}@US.M"
    eval_str = "#{testing_prefix}CPIRPP_#{name_id}@#{is_hawaii ? "HI" : "US"}.M"
    eval_str = "((\"#{eval_str}\".ts) / (\"#{cpi_us_series}\".ts)) * 100"
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

  # SBS quarterly and annual aggregate
  # same name as above save for frequency
  # this is quarterly
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
      :prefix => "#{testing_prefix}SBSCPIRPP_#{name_id}",
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
      :dataPortalName => "CPIRPP AGGREGATED #{regions[idx]}",
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

    # set up load statement
    name_id = name_ids[idx]
    eval_str = "#{testing_prefix}SBSCPIRPP_#{name_id}@#{in_hawaii ? "HI" : "US"}.M"
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

  # this is annual
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
      :prefix => "#{testing_prefix}SBSCPIRPP_#{name_id}",
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
      :dataPortalName => "CPIRPP AGGREGATED #{regions[idx]}",
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

    # set up load statement
    name_id = name_ids[idx]
    eval_str = "#{testing_prefix}SBSCPIRPP_#{name_id}@#{in_hawaii ? "HI" : "US"}.M"
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
