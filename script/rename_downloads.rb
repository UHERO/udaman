Download.all.each do |d|
  spo = d.save_path_obsolete.dup
  spo.sub!(ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH'])
  #pathbase = File.basename(spo)
  begin
    File.rename(spo, d.save_path)
  rescue => e
    Rails.logger.error e.message
  end
end
