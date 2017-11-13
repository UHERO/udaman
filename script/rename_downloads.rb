Download.all.each do |d|
  begin
    File.rename(d.save_path, d.new_save_path)
  rescue => e
    Rails.logger.error e.message
  end
end