class NewDbedtUpload < ApplicationRecord
  include HelperUtilities
  require 'date'

  enum status: { processing: 'processing', ok: 'ok', fail: 'fail' }

  def store_upload_file(filename)
    return false unless filename
    now = Time.now
    filename_content = filename.read
    filename_ext = filename.original_filename.split('.')[-1]
    self.assign_attributes(upload_at: Time.now,
                           status: :processing,
                           filename: make_filename(now, filename_ext))
    begin
      self.save or raise 'DBEDT upload object save failed'
      write_file_to_disk(filename, filename_content) or raise 'DBEDT upload disk write failed'
      DbedtWorker.perform_async(id, do_csv_proc: true)
    rescue => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def NewDbedtUpload.delete_universe_dbedt
    ## Series, Xseries, and DataSources are NOT deleted, but updated as necessary.
    ## Geographies also not deleted, but handled in hardcoded fashion.
    ## Categories and DataLists deleted in Rails code.
    NewDbedtUpload.connection.execute <<~MYSQL
        SET FOREIGN_KEY_CHECKS = 0;
    MYSQL
    Rails.logger.info { 'delete_universe_dbedt: public_data_points' }
    NewDbedtUpload.connection.execute <<~MYSQL
      delete p
      from public_data_points p join series s on s.id = p.series_id
      where s.universe = 'DBEDT' ;
    MYSQL
    Rails.logger.info { 'delete_universe_dbedt: data_points' }
    NewDbedtUpload.connection.execute <<~MYSQL
      delete d
      from data_points d join series s on s.xseries_id = d.xseries_id
      where s.universe = 'DBEDT' ;
    MYSQL
    Rails.logger.info { 'delete_universe_dbedt: measurement_series' }
    NewDbedtUpload.connection.execute <<~MYSQL
      delete ms from measurement_series ms join measurements m on m.id = ms.measurement_id where m.universe = 'DBEDT' ;
    MYSQL
    Rails.logger.info { 'delete_universe_dbedt: data_list_measurements' }
    NewDbedtUpload.connection.execute <<~MYSQL
      delete dm from data_list_measurements dm join data_lists d on d.id = dm.data_list_id where d.universe = 'DBEDT' ;
    MYSQL
    Rails.logger.info { 'delete_universe_dbedt: measurements' }
    NewDbedtUpload.connection.execute <<~MYSQL
      delete from measurements where universe = 'DBEDT' ;
    MYSQL
    Rails.logger.info { 'delete_universe_dbedt: units' }
    NewDbedtUpload.connection.execute <<~MYSQL
      delete from units where universe = 'DBEDT' ;
    MYSQL
    Rails.logger.info { 'delete_universe_dbedt: sources' }
    NewDbedtUpload.connection.execute <<~MYSQL
      delete from sources where universe = 'DBEDT' ;
    MYSQL
    NewDbedtUpload.connection.execute <<~MYSQL
        SET FOREIGN_KEY_CHECKS = 1;
    MYSQL
  end

  def load_meta_csv
    mylogger :info, 'starting load_meta_csv'
    csv_dir_path = path(filename).change_file_extension('')
    csv_path = File.join(csv_dir_path, 'indicator.csv')
    raise "File #{csv_path} not found" unless File.exists? csv_path

    category = nil
    CSV.foreach(csv_path, {col_sep: "\t", headers: true, return_headers: false}) do |row_pairs|
      row = {}
      row_pairs.to_a.each do |header, data|   ## convert row to hash keyed on column header, force blank/empty to nil
        next if header.blank?
        val = data.blank? ? nil : data.strip
        row[header.strip.downcase] = Integer(val) rescue val  ## convert integers to Integer type if possible
      end
      # category entry
      indicator_id = row['ind_id']
      break if indicator_id.blank?  ## end of file
      parent_indicator_id = row['parent_id']
      parent_label = "DBEDT_#{parent_indicator_id}"

      if row['unit'].blank?
        category = Category.find_by(universe: 'DBEDT', meta: "DBEDT_#{indicator_id}")
        if category.nil?
          ancestry = Category.find_by(universe: 'DBEDT', ancestry: nil).id rescue raise('No DBEDT root category found')
          unless parent_indicator_id.nil?
            parent_category = Category.find_by(universe: 'DBEDT', meta: parent_label)
            unless parent_category.nil?
              ancestry = parent_category.ancestry + '/' + parent_category.id.to_s
            end
          end
          category = Category.create(
              meta: "DBEDT_#{indicator_id}",
              universe: 'DBEDT',
              name: row['indicatorfortable'],
              ancestry: ancestry,
              list_order: row['order']
          )
          Rails.logger.info { "DBEDT Upload id=#{id}: created category #{category.meta} in universe #{category.universe}" }
        end
      end

      # data_list_measurements entry
      unless row['unit'].blank?
        data_list = DataList.find_by(universe: 'DBEDT', name: parent_label)
        if data_list.nil?
          data_list = DataList.create(name: parent_label, universe: 'DBEDT')
          unless category.nil?
            category.update data_list_id: data_list.id
          end
        end
        measurement = Measurement.find_by(universe: 'DBEDT', prefix: "DBEDT_#{indicator_id}")
        if measurement.nil?
          measurement = Measurement.create(
              universe: 'DBEDT',
              prefix: "DBEDT_#{indicator_id}",
              data_portal_name: row['indicator']
          )
        else
          measurement.update data_portal_name: row['indicator']
        end
        if data_list.measurements.where(id: measurement.id).empty?
          data_list.measurements << measurement
        end
        dlm = DataListMeasurement.find_by(data_list_id: data_list.id, measurement_id: measurement.id)
        dlm.update(list_order: row['order'].to_i) if dlm
        Rails.logger.debug { "added measurement #{measurement.prefix} to data_list #{data_list.name}" }
      end
    end
    mylogger :info, 'done load_meta_csv'
    true
  end

  def load_series_csv
    mylogger :info, 'starting load_series_csv'
    csv_dir_path = path(filename).change_file_extension('')
    csv_path = File.join(csv_dir_path, 'data.csv')
    raise "File #{csv_path} not found" unless File.exists? csv_path

    dp_data_set = []
    CSV.foreach(csv_path, {col_sep: "\t", headers: true, return_headers: false}) do |row_pairs|
      row = {}
      row_pairs.to_a.each do |header, data|  ## convert row to hash keyed on column header, force blank/empty to nil
        next if header.blank?
        row[header.strip.downcase] = data.blank? ? nil : data.strip
      end
      next if row['value'].nil?
      break if row['module'].nil?  ## in case there are blank rows appended at the end
      row['date'] = make_date(row['year'].to_i, row['qm'].to_s)
      row_values = %w{module frequency date value
                              group module
                              market module
                              destination module
                              category module
                              indicator module}.map{|d| row[d] }
      dp_data_set.push row_values
    end

    dp_query = <<~MYSQL
      insert into data_points
        (`module`,`frequency`,`date`,`value`,`group_id`,`market_id`,`destination_id`,`category_id`,`indicator_id`)
      select ?, ?, ?, ?, g.id, m.id, d.id, c.id, i.id
        from indicators i
          left join `groups` g on g.handle = ? and g.module = ?
          left join markets m on m.handle = ? and m.module = ?
          left join destinations d on d.handle = ? and d.module = ?
          left join categories c on c.handle = ? and c.module = ?
       where i.handle = ?
         and i.module = ?;
    MYSQL
    ## This is likely to be slow... later work on a way to make it faster?
    ## Maybe add dimension handle columns to the data table, insert these, then convert to int IDs in postproc?
    dp_data_set.in_groups_of(1000, false) do |dps|
      db_execute_set dp_query, dps
    end
    ##### if load successful...
    make_active_settings
    mylogger :info, 'done load_series_csv'
    dp_data_set.count
  end

  def load_data_postproc(num)
    ## nothing to do yet, except return the number of loaded data points that is passed in
    num
  end

  def make_active_settings
    self.transaction do
      NewDbedtUpload.update_all(active: false)
      self.update_attributes(active: true, last_error: nil, last_error_at: nil)
    end
  end

  def full_load
    delete_universe_dbedt
    load_meta_csv
    num = load_series_csv
    load_data_postproc(num)
  end

  def worker_tasks(do_csv_proc: false)
    csv_extract if do_csv_proc
    mylogger :debug, 'before full_load'
    total = full_load
    self.update(status: :ok, last_error: "#{total} data points loaded", last_error_at: nil)
    mylogger :info, 'loaded and active'
  end

  def absolute_path
    path(filename)
  end

private

  def csv_extract
    xls_path = absolute_path
    csv_path = xls_path.change_file_extension('') ### truncate extension to make a directory name
    other_worker = ENV['OTHER_WORKER']

    unless File.exists?(xls_path)
      mylogger :warn, "xls file #{xls_path} does not exist"
      if other_worker.blank?
        raise "Could not find xlsx file ((#{xls_path}) #{id}) and no $OTHER_WORKER defined"
      end
      unless system("rsync -t #{other_worker + ':' + xls_path} #{xls_path}")
        raise "Could not get xlsx file ((#{xls_path}) #{id}) from $OTHER_WORKER: #{other_worker} (#{$?})"
      end
    end
    unless system "xlsx2csv.py -a -d tab -c utf-8  #{xls_path} #{csv_path}"
      raise "Could not transform xlsx to csv (#{id}:#{$?})"
    end

    Dir.glob(File.join(csv_path, '*.csv')).each {|f| File.rename(f, f.downcase) } ## force csv filenames to lower case

    if other_worker && !system("rsync -rt #{csv_path} #{other_worker + ':' + csv_path}")
      raise "Could not copy #{csv_path} for #{id} to $OTHER_WORKER: #{other_worker} (#{$?})"
    end
  end

  def path(name = nil)
    if name =~ /[\\]*\.[\\]*\./  ## paths that try to access Unix '..' convention for parent directory
      Rails.logger.warn { 'WARNING! Attempt to access filesystem path %s' % name }
      return
    end
    parts = [ENV['DATA_PATH'], 'dbedt_files']
    parts.push(name) unless name.blank?
    File.join(parts)
  end

  def make_filename(time, ext)
    ## a VERY rough heuristic for whether we have a correct file extention
    ext = ext.length > 4 ? '' : ('.' + ext)
    time.strftime('%Y-%m-%d-%H:%M') + '_upload' + ext
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

  def db_execute(query, values = [])
    stmt = NewDbedtUpload.connection.raw_connection.prepare(query)
    stmt.execute(*values)  ## if you don't know what this * is, you can google for "ruby splat"
  end

  def db_execute_set(query, set)
    stmt = NewDbedtUpload.connection.raw_connection.prepare(query)
    set.each {|values| stmt.execute(*values) }
  end

  def make_date(year, mq)
    month = 1
    begin
      if mq =~ /([MQ])(\d+)/i
        month = $1.upcase == 'M' ? $2.to_i : first_month_of_quarter($2)
      end
      '%d-%02d-01' % [year, month]
    rescue
      year_msg = year.blank? ? ' is empty' : "=#{year}"
      raise "Bad date params: year#{year_msg}, QM='#{mq}'"
    end
  end

  def incr_order(ohash, level)
    ## all lower levels get reset each time we increment a level
    (level+1..).each do |n|
      break if ohash[n].nil?
      ohash[n] = 0
    end
    ohash[level] += 1
  end

  def mylogger(level, message)
    Rails.logger.send(level) { "#{Time.now} NewDbedtUpload id=#{self.id}: #{message}" }
  end
end
