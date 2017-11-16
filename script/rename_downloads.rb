Download.all.each do |d|
  spo = d.save_path_obsolete && d.save_path_obsolete.dup
  spo.sub!(ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH'])
  #pathbase = File.basename(spo)
  begin
    File.rename(spo, d.save_path)
    unless d.file_to_extract.blank?
      fte = d.file_to_extract.dup
      fte.sub!(ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH'])
      ftedir = File.dirname(fte)
      ftebase = File.basename(fte)
      File.rename(ftedir, d.save_path(true))
      d.update_attributes(file_to_extract: ftebase)
    end
  rescue => e
    Rails.logger.error e.message
  end
end
