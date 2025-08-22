#!/usr/bin/env ruby

# seven sets of series to be made
# two supplementary CSVs

# important stuff below

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

# following values should be consistent across series
unit_id = "129"
bls_source_id = "2"
bls_interp_source_id = "29"
us_geo_id = "7"
hi_geo_id = "1"

# get base monthly series
load_statement_template = "Series.load_api_bls_NEW(\"xxxx\", \"M\")"
csv_load_statement_template = "\"xxxx\".tsn.load_from(\"rparsed/noninterp.csv\")"
ids.each_with_index do |id, idx|
  next if idx == 0  # skip city avg

  geo_id = regions[idx] != "Urban Hawaii" ? us_geo_id : hi_geo_id

  # set up series attrs
  name_parts = {
    :prefix => "ELEETEST#{id}",
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
  ds_attrs = {
    :eval => eval_str,
    :priority => 50,
    :scale => "1.0",
    :presave_hook => "",
    :clear_before_load => "0",
    :pseudo_history => "0",
    :series_id => "#{s.id}"
  }

  # create ds
  ds = DataSource.new(ds_attrs)
  ds.create_from_form

  # part 2 (the historical data csv)
  # set up load statement
  eval_str = csv_load_statement_template.sub "xxxx", id
  ds_attrs = {
    :eval => eval_str,
    :priority => 50,
    :scale => "1.0",
    :presave_hook => "",
    :clear_before_load => "0",
    :pseudo_history => "0",
    :series_id => "#{s.id}"
  }

  # create ds
  ds = DataSource.new(ds_attrs)
  ds.create_from_form
end



