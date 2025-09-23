## Q and A were left out of the original script for some reason. Adding them here.
## Merge the two tasks before using this on prod.
task :create_cpirpp_i => :environment do
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
