task :rename_downloaded_files => :environment do
  Download.all.each do |d|
    spo = d.save_path_obsolete && d.save_path_obsolete.dup
    puts "------------"
    next unless spo
    spo.sub!(ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH'])
    puts "DOING #{spo}"
    begin
      if File.exists?(spo)
        puts "#{spo} exists....."
        File.rename(spo, d.save_path)
      end
      if Dir.exists?(spo + '_vintages')
        puts "#{spo + '_vintages'} exists....."
        Dir.rename(spo + '_vintages', d.save_path + '_vintages')
      end
      unless d.file_to_extract.blank?
        puts "F2E block entered"
        fte = d.file_to_extract.dup
        fte.sub!(ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH'])
        ftedir = File.dirname(fte)
        ftebase = File.basename(fte)
        if Dir.exists?(ftedir)
          Dir.rename(ftedir, d.save_path(true))
        end
        d.update_attributes(file_to_extract: ftebase)
      end
    rescue => e
      Rails.logger.error e.message
    end
  end
end
