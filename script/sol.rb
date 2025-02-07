#!/usr/bin/env ruby

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

filepath = "rparsed/data.csv"
us_series_name = "CPIRPP0000@US.M"  # also tbd

ids.each_with_index do |id, idx|
  region = regions[idx]
  rf_city = rf_cities[idx]
  rf_us = rf_cities[0]
  id_us = ids[0]
  
  s = "CPIRPP#{id[4...-3]}@US.M"

  # exception for urban hawaii
  if id == "CUURS49FSA0"
    s = "CPIRPP#{id[4...-3]}@HI.M"
  elsif id == ids[0]
    next  # skip us
  end

  # skip if series exists 
  series_exists = Series.find_by(name: s)
  next if series_exists

  # just gonna use the controller
  controller = SeriesController.new

  # create name parts
  name_parts = {}
  name_parts[:prefix] = s.split("@").first
  name_parts[:freq] = s.split("@").last.split(".").last
  geo_id = s.split("@").last.split(".").first
  # check at https://udaman.uhero.hawaii.edu/geographies?u=univ_name
  geo_mappings = {
    "HI" => "1",
    "HAW" => "2",
    "HAWK" => "11",
    "HAWH" => "12",
    "HON" => "3",
    "KAU" => "4",
    "LAN" => "9",
    "MAU" => "5",
    "MOL" => "10",
    "MAUI" => "8",
    "US" => "7"
  }
  name_parts[:geography_id] = geo_mappings[geo_id] 

  # create the parameters
  series_params = {
    :universe => "UHERO",
    :description => "",
    :dataPortalName => "#{s}",
    :unit_id => "129",  # index us avg
    :source_id => "2",  # bls
    :source_link => "",
    :source_detail_id => "",
    :investigation_notes => "",
    :decimals => "1",
  }
 
  xseries_attributes = {
    :percent => "false",
    :seasonal_adjustment => "not_seasonally_adjusted",
    :frequency_transform => "average",
    :restricted => "false"
  }
  
  series_params[:xseries_attributes] = xseries_attributes
  series_params[:name_parts] = name_parts

  begin
    puts series_params
    new_series = Series.create_new(series_params)
    if not new_series
      puts "Error occuring in creation"
      break
    end
  rescue => e
    puts "Error: #{e}"
    break
  end
  
  # loader 1
  # from api
  loader_attrs = {
    :eval => "(Series.load_api_bls_NEW(\"#{id}\", \"M\")*#{rf_city})/(Series.load_api_bls_NEW(\"#{id_us}\", \"M\")*#{rf_us})",
    :priority => "100",
    :scale => "1.0",
    :color => "B2A1EA",
    :presave_hook => "",
    :clear_before_load => "0"
  }
  new_series.save_loader(loader_attrs, new_series.data)

  # loader 2
  # from file
  loader_attrs = {
    :eval => "(\"#{new_series.name}\".tsn.load_from(\"#{filepath}\")*#{rf_city})/(\"#{us_series_name}\".tsn.load_from(\"#{filepath}\")*#{rf_us})",
    :priority => "50",
    :scale => "1.0",
    :color => "F9FF8B",
    :presave_hook => "",
    :clear_before_load => "0"
  }
  new_series.save_loader(loader_attrs, new_series.data)
end
