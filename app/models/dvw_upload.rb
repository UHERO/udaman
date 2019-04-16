class DvwUpload < ApplicationRecord
  require 'date'
  before_destroy :delete_files_from_disk
  before_destroy :delete_data_and_data_sources

  enum status: { processing: 'processing', ok: 'ok', fail: 'fail' }

  def store_upload_files(series_file)
    now = Time.now.localtime
    return false unless series_file
    series_file_content = series_file.read
    series_file_ext = series_file.original_filename.split('.')[-1]
    self.series_filename = DvwUpload.make_filename(now, 'series', series_file_ext)
    self.set_status('series', :processing)

    self.upload_at = Time.now
    begin
      self.save or raise StandardError, 'DVW upload object save failed'
      write_file_to_disk(series_filename, series_file_content) or raise StandardError, 'DVW upload disk write failed'
      DvwWorker.perform_async(id, true)
    rescue => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def set_active(status)
    self.update! active: status
  end

  def make_active
    DvwUpload.update_all active: false
    DvwWorker.perform_async(self.id)
    self.update series_status: :processing
  end

  def make_active_settings
    DvwUpload.update_all active: false
    self.update! active: true, last_error: nil, last_error_at: nil
  end

  def get_status(which)
    if which == 'cats'
      cats_status
    else
      series_status
    end
  end

  def set_status(which, status)
    if which == 'cats'
      self.update_attributes(:cats_status => status)
    else
      self.update_attributes(:series_status => status)
    end
  end

  def absolute_path(which = nil)
    if which == 'cats'
      path(cats_filename)
    elsif which == 'series'
      path(series_filename)
    else
      path
    end
  end

  def retrieve_series_file
    read_file_from_disk(series_filename)
  end

  def delete_series_file
    xlspath = absolute_path('series')
    if series_filename && File.exists?(xlspath)
      r = delete_file_from_disk xlspath
      r &&= FileUtils.rm_rf xlspath.change_file_extension('')  ## the dir containing csv files -dji
      return (r || throw(:abort))
    end
    true
  end

  def full_load
    Rails.logger.debug { "DvwUpload id=#{id} BEGIN full load #{Time.now}" }
    DvwUpload.delete_universe_dvw

    load_meta_csv('Group')
    Rails.logger.debug { "DvwUpload id=#{id} DONE load groups #{Time.now}" }
    load_meta_csv('Market')
    Rails.logger.debug { "DvwUpload id=#{id} DONE load markets #{Time.now}" }
    load_meta_csv('Destination')
    Rails.logger.debug { "DvwUpload id=#{id} DONE load destinations #{Time.now}" }
    load_meta_csv('Category')
    Rails.logger.debug { "DvwUpload id=#{id} DONE load categories #{Time.now}" }
    load_meta_csv('Indicator')
    Rails.logger.debug { "DvwUpload id=#{id} DONE load indicators #{Time.now}" }

    load_series_csv
    Rails.logger.debug { "DvwUpload id=#{id} DONE load series #{Time.now}" }
    load_data_postproc
    Rails.logger.debug { "DvwUpload id=#{id} DONE load postproc #{Time.now}" }
    make_active_settings
    Rails.logger.info { "DvwUpload id=#{id} loaded as active #{Time.now}" }
    true
  end

  def load_meta_csv(dimension)
    Rails.logger.debug { "starting load_csv #{dimension}" }
    csv_dir_path = path(series_filename).change_file_extension('')
    csv_path = File.join(csv_dir_path, "#{dimension}.csv")
    raise "DvwUpload: couldn't find file #{csv_path}" unless File.exists? csv_path

    datae = []
    columns = %w{module handle nameP nameW nameT data parent level}
    columns.concat %w{unit decimal} if dimension == 'Indicator'

    CSV.foreach(csv_path, {col_sep: "\t", headers: true, return_headers: false}) do |row_pairs|
      row = {}
      row_pairs.to_a.each do |header, data|   ## convert row to hash keyed on column header, force blank/empty to nil
        row[header.strip] = data.blank? ? nil : data.strip
      end
      row_values = []
      columns.each do |col|
        raise "Data contains single quote in #{dimension}, #{row['handle']} row, #{col} column" if row[col] =~ /'/
        if row[col].nil?
          row_values.push 'null'
          next
        end
        row_values.push case col
                          when 'data' then (row[col].to_s == '0' ? 1 : 0) ## semantically inverted, goes in as header
                          when 'level', 'decimal' then row[col].to_i
                          else "'%s'" % row[col]
                        end
      end
      datae.push '(%s)' % row_values.join(',')
    end
    columns[columns.index('data')] = 'header'  ## rename "data" column as "header" - kinda hacky
    cols_string = columns.map {|c| '`%s`' % c }.join(',') ## wrap names in backtix
    vals_string = datae.join(',')
    execute_db "INSERT INTO #{dimension.pluralize} (#{cols_string}) VALUES #{vals_string};"
    Rails.logger.debug { "done load_csv #{dimension}" }
    true
  end

  def load_series_csv
    Rails.logger.debug { 'starting load_series_csv' }
    csv_path = path(series_filename).change_file_extension('')
    csv_path
  end

  def DvwUpload.load(id)
    DvwUpload.find(id).full_load
  end

  def DvwUpload.average(id, group)
    # this method is a noop/placeholder
    "#{id} #{group}"
  end

  def DvwUpload.delete_universe_dvw
    execute_db <<-SQL
      delete from data_points;
      delete from indicators;
      delete from groups;
      delete from markets;
      delete from destinations;
      delete from categories;
    SQL
  end

  def load_data_postproc
    #Rails.logger.debug { "DEBUG: DvwWorker starting load_data_postproc at #{Time.now}" }
    # populate the parent_id column based on parent string values
  end

private
  def path(name = nil)
    parts = [ENV['DATA_PATH'], 'dvw_files']
    parts.push(name) unless name.blank?
    File.join(parts)
  end

  def DvwUpload.make_filename(time, type, ext)
    ## a VERY rough heuristic for whether we have a correct file extention
    ext = ext.length > 4 ? '' : '.' + ext
    time.strftime('%Y-%m-%d-%H:%M:%S') + '_' + type + ext
  end

  def write_file_to_disk(name, content)
    begin
      File.open(path(name), 'wb') { |f| f.write(content) }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def read_file_from_disk(name)
    begin
      content = File.open(path(name), 'r') { |f| f.read }
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    content
  end

  def delete_file_from_disk(abspath)
    begin
      File.delete(abspath)
    rescue StandardError => e
      Rails.logger.error e.message
      return false
    end
    true
  end

  def delete_files_from_disk
    delete_series_file
  end

  def delete_data_and_data_sources
    run_db <<~SQL
      DELETE FROM data_points
      WHERE data_source_id IN (SELECT id FROM data_sources WHERE eval LIKE 'DvwUpload.load(#{self.id},%)');
    SQL
  end

  def execute_db(query)
    DvwUpload.connection.execute "use dbedt_visitor_dw; #{query};"
  end
end
