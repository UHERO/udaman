task :rename_downloaded_files => :environment do
  seen_paths = {}
  Download.all.each do |d|
    old_path = d.save_path_obsolete && d.save_path_obsolete.dup
    puts '------------'
    next unless old_path
    old_path.sub!(ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH'])
    puts "DOING #{old_path}"
    begin
      if File.exists?(old_path)
        puts "#{old_path} exists....."
        File.rename(old_path, d.save_path)
        seen_paths[old_path] = d.save_path
      elsif seen_paths[old_path]
        FileUtils.cp(seen_paths[old_path], d.save_path)
      end
      if Dir.exists?(old_path + '_vintages')
        puts "#{old_path + '_vintages'} exists....."
        File.rename(old_path + '_vintages', d.save_path + '_vintages')
      end
      unless d.file_to_extract.blank?
        puts "F2E block entered"
        fte = d.file_to_extract.dup
        fte.sub!(ENV['DEFAULT_DATA_PATH'], ENV['DATA_PATH'])
        ftedir = File.dirname(fte)
        ftebase = File.basename(fte)
        if Dir.exists?(ftedir)
          File.rename(ftedir, d.save_path(true))
          seen_paths[ftedir] = d.save_path(true)
        elsif seen_paths[ftedir]
          FileUtils.cp_r(seen_paths[ftedir], d.save_path(true))
        end
        d.update_attributes(file_to_extract: ftebase)
      end
    rescue => e
      Rails.logger.error e.message
    end
  end
end
