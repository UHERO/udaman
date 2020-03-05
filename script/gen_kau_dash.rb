require 'csv'

Rails.logger.info { "Gen KAU dash: Start at #{Time.now}" }
token = '-VI_yuv0UzZNy4av1SM5vQlkfPK_JKnpGfMzuJR7d0M='
cmd = %q{curl --silent -H "Authorization: Bearer %s" } % token
url = %q{https://api.uhero.hawaii.edu/v1/package/export?id=%d\&nocache}

export_ids = %w{127 141 143}  ### probly automate this

export_ids.each do |xid|
  response = %x{#{cmd + url % xid}}
  json = JSON.parse response
  data = {}
  names = []
  titles = {}
  series_array = json['data']
  series_array.each do |series|
    name = series['name']
    names.push name
    titles[name] = series['title']
    levels = series['seriesObservations']['transformationResults'][0]
    data[name] = levels['dates'].map {|date| [date, levels['values'].shift ] }.to_h
  end
end
CSV.generate do |csv|
  csv << ['date'] + names
  get_all_dates(data).each do |date|
    csv << [date] + names.map {|series_name| data[series_name][date] }
  end
end
Rails.logger.info { "Gen KAU dash: End at #{Time.now}" }

def get_all_dates(series_data)
  dates_array = []
  series_data.each {|_, data| dates_array |= data.keys }
  dates_array.sort
end
