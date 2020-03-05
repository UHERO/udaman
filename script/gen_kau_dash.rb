Rails.logger.info { "Gen KAU dash: Start at #{Time.now}" }
token = '-VI_yuv0UzZNy4av1SM5vQlkfPK_JKnpGfMzuJR7d0M='
url = %q{https://api.uhero.hawaii.edu/v1/package/export?id=%d\&nocache}
cmd = %q{curl --silent -H "Authorization: Bearer %s" } % token

export_ids = %w{127 141 143}
export_ids.each do |xid|
  full_url = url % xid
  response = %x{#{cmd + full_url}}
  json = JSON.parse response
  series_array = json['data']
  series_array.each do |series|
    name = series['name']
    title = series['title']
    startdate = series['seriesObservations']['observationStart']
    enddate = series['seriesObservations']['observationEnd']
    levels = series['seriesObservations']['transformationResults'][0]
    data_dates = levels['dates']
    data_values = levels['values']
  end
end
