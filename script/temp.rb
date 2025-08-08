#!/usr/bin/env ruby

series = [
    'VAPNS@HI.D',
    'VAPDMNS@HI.D',
    'VAPDMNS@HON.D',
    'VAPDMNS@MAU.D',
    'VAPDMNS@HAW.D',
    'VAPDMNS@KAU.D',
    'VAPITNS@HI.D',
    'VAPITJPNS@HI.D',
    'VAPITOTNS@HI.D'
]

# gather all data sources
data_source_ids = []
series.each do |s|
  ids = Series.find_by(name: s).data_source_ids
  data_source_ids.concat(ids)
end

# delete all data sources
controller = DataSourcesController.new
data_source_ids.each do |id|
  begin
    controller.instance_variable_set('@data_source', DataSource.find(id))
    controller.delete
  rescue => e
    puts "Error: #{e}"
  end
end

# add new data sources
# UHEROroot/work/udamandata/rparsed/vap.csv
# ***load statement w/last 365 days
# UHEROroot/work/udamandata/rparsed/vap_upd_hist.csv
# ***load statement w/history
series.each do |s|
  a = Series.find_by(name: s)

  loader_attrs = {
    :eval => "\"#{s}\".tsn.load_from \"rparsed/vap.csv\"",
    :priority => "100",
    :scale => "0.001",
    :color => "F9FF8B",
    :presave_hook => "",
    :clear_before_load => "0"
  }
  a.save_loader(loader_attrs, a.data)  

  loader_attrs = {
    :eval => "\"#{s}\".tsn.load_from \"rparsed/vap_upd_hist.csv\"",
    :priority => "100",
    :scale => "0.001",
    :color => "FBFFBD",
    :presave_hook => "",
    :clear_before_load => "0"
  }
  a.save_loader(loader_attrs, a.data)  
end
