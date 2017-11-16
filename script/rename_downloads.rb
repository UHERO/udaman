Download.all.each do |d|
  spo = d.save_path_obsolete.dup
  spo.sub!(ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH'])
  #pathbase = File.basename(spo)
  begin
    File.rename(spo, d.save_path)
    fte = d.file_to_extract.dup
    unless fte.blank?
      fte.sub!(ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH'])
      ftepath = File.dirname(fte)
      ftebase = File.basename(fte)
      File.rename(ftepath, what?)
      d.update_attributes(file_to_extract: ftebase)
    end
  rescue => e
    Rails.logger.error e.message
  end
end
