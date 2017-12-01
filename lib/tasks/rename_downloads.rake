task :rename_downloaded_files => :environment do
  Download.all.each do |d|
    spo = d.save_path_obsolete && d.save_path_obsolete.dup
    next unless spo
    spo.sub!(ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH'])
    begin
      File.rename(spo, d.save_path)
      unless d.file_to_extract.blank?
        fte = d.file_to_extract.dup
        fte.sub!(ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH'])
        ftedir = File.dirname(fte)
        ftebase = File.basename(fte)
        Dir.rename(ftedir, d.save_path(true))
        d.update_attributes(file_to_extract: ftebase)
      end
    rescue => e
      Rails.logger.error e.message
    end
  end
end
