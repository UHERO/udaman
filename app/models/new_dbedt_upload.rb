class NewDbedtUpload < ApplicationRecord
  include HelperUtilities
  require 'date'

  enum status: { processing: 'processing', ok: 'ok', fail: 'fail' }

  def store_upload_file(file)
    return false unless file
    now = Time.now
    file_content = file.read
    filename_ext = file.original_filename.split('.')[-1]
    self.assign_attributes(upload_at: now,
                           active: false,
                           status: :processing,
                           filename: make_filename(now, filename_ext))
    #mylogger :debug, "1>>>>>>>>>>>>>>>>>>>> |#{filename_ext}|#{snax}|#{snax.class}|"
    #mylogger :debug, "2>>>>>>>>>>>>>>>>>>>> ||#{self.attribute_names}||"
    begin
      self.save
      write_file_to_disk(filename, file_content)
      DbedtWorker.perform_async(id, true)
    rescue => e
      mylogger :error, e.message
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def delete_universe_dbedt
    ## Series, Xseries, and DataSources are NOT deleted, but updated as necessary.
    ## Geographies also not deleted, but handled in hardcoded fashion.
    Category.where('universe = "DBEDT" and ancestry is not null').delete_all
    DataList.where(universe: 'DBEDT').destroy_all

    db_execute <<~MYSQL
      SET FOREIGN_KEY_CHECKS = 0;
    MYSQL
    mylogger :info, 'delete_universe_dbedt: public_data_points'
    db_execute <<~MYSQL
      delete p
      from public_data_points p join series s on s.id = p.series_id
      where s.universe = 'DBEDT' ;
    MYSQL
    mylogger :info, 'delete_universe_dbedt: data_points'
    db_execute <<~MYSQL
      delete d
      from data_points d join series s on s.xseries_id = d.xseries_id
      where s.universe = 'DBEDT' ;
    MYSQL
    mylogger :info, 'delete_universe_dbedt: measurement_series'
    db_execute <<~MYSQL
      delete ms from measurement_series ms join measurements m on m.id = ms.measurement_id where m.universe = 'DBEDT' ;
    MYSQL
    mylogger :info, 'delete_universe_dbedt: data_list_measurements'
    db_execute <<~MYSQL
      delete dm from data_list_measurements dm join data_lists d on d.id = dm.data_list_id where d.universe = 'DBEDT' ;
    MYSQL
    mylogger :info, 'delete_universe_dbedt: measurements'
    db_execute <<~MYSQL
      delete from measurements where universe = 'DBEDT' ;
    MYSQL
    mylogger :info, 'delete_universe_dbedt: units'
    db_execute <<~MYSQL
      delete from units where universe = 'DBEDT' ;
    MYSQL
    mylogger :info, 'delete_universe_dbedt: sources'
    db_execute <<~MYSQL
      delete from sources where universe = 'DBEDT' ;
    MYSQL
    db_execute <<~MYSQL
      SET FOREIGN_KEY_CHECKS = 1;
    MYSQL
  end

  def load_meta_csv
    mylogger :info, 'starting load_meta_csv'
    csv_dir_path = path(filename).change_file_extension('')
    csv_path = File.join(csv_dir_path, 'indicator.csv')
    raise "File #{csv_path} not found" unless File.exists? csv_path

    category = nil
    allmeta = {}
    cats_ances = {}
    root_cat = Category.find_by(universe: 'DBEDT', ancestry: nil).id rescue raise('No DBEDT root category found')

    CSV.foreach(csv_path, { col_sep: "\t", headers: true, return_headers: false }) do |pairs|
      row = {}
      pairs.to_a.each do |header, data|   ## convert row to hash keyed on column header, force blank/empty to nil
####        mylogger(:info, ">>>>>> h=#{header}, d=#{data}") if data =~ /ship/
        break if header.blank?
        val = data.blank? ? nil : data.to_ascii.strip
        row[header.strip.downcase] = (Integer(val) rescue val)  ## convert integers to Integer type if possible
      end
      mylogger(:info, "ROW ROW ROW: #{row}") if row['indicator'] =~ /ship/

      indicator_id = row['ind_id']
      break if indicator_id.blank?  ## end of file
      allmeta[indicator_id] = row   ## store a copy for later use by load_series_csv
      parent_indicator_id = row['parent_id']
      parent_label = "DBEDT_#{parent_indicator_id}"

      unless row['unit']  ####################### category entry
        raise "Order missing for #{indicator_id}" unless row['order']
        ancestry = root_cat
        if parent_indicator_id
          if cats_ances[parent_indicator_id]
            ancestry = cats_ances[parent_indicator_id]
          else
            ## This else block should (almost) never be executed
            #parent_cat = Category.find_by(universe: 'DBEDT', meta: parent_label) ||
                raise("No parent category found for #{parent_indicator_id}")
            #ancestry = cats_ances[parent_indicator_id] = '%d/%d' % [parent_cat.ancestry, parent_cat.id]
          end
        end
        category = Category.create(
            meta: "DBEDT_#{indicator_id}",
            universe: 'DBEDT',
            name: row['indicatorfortable'],
            ancestry: ancestry,
            list_order: row['order']
        )
        cats_ances[indicator_id] = '%s/%d' % [ancestry, category.id]
        mylogger :info, "DBEDT Upload id=#{id}: created category #{category.meta}, #{category.name}"
      end

      if row['unit']  ####################### data_list, measurements entry
        unless row['order'] && row['source'] && row['decimal']
          raise "Order, source, or decimal missing for #{indicator_id}"
        end
        data_list = DataList.find_by(universe: 'DBEDT', name: parent_label)
        if data_list.nil?
          data_list = DataList.create(universe: 'DBEDT', name: parent_label)
          category.update(data_list_id: data_list.id) if category
        end
        measurement = Measurement.create(
            universe: 'DBEDT',
            prefix: "DBEDT_#{indicator_id}",
            data_portal_name: row['indicator']
        )
        data_list.measurements << measurement
        dlm = DataListMeasurement.find_by(data_list_id: data_list.id, measurement_id: measurement.id)
        dlm.update(list_order: row['order']) if dlm
        mylogger :debug, "added measurement #{measurement.prefix} to data_list #{data_list.name}"
      end
    end
    mylogger :info, 'done load_meta_csv'
    allmeta
  end

  def load_series_csv(metadata)
    mylogger :info, 'starting load_series_csv'
    csv_dir_path = path(filename).change_file_extension('')
    csv_path = File.join(csv_dir_path, 'data.csv')
    raise "File #{csv_path} not found" unless File.exists? csv_path

    current_series = nil
    current_data_source = nil
    current_measurement = nil
    allgeos = {}
    allsources = {}
    allunits = {}
    data_points = []

    CSV.foreach(csv_path, { col_sep: "\t", headers: true, return_headers: false }) do |pairs|
      row = {}
      pairs.to_a.each do |header, data|  ## convert row to hash keyed on column header, force blank/empty to nil
        break if header.blank?
        val = data.blank? ? nil : data.to_ascii.strip
        row[header.strip.downcase] = (Integer(val) rescue Float(val) rescue val)  ## convert numeric types if possible. Parens are crucial!
       # mylogger :info, ">>>>>> h=#{header.strip.downcase}, v=|#{val}|, sn=|#{snax}|, hv=|#{row[header.strip.downcase]}|"
      end

      ind_id = row['ind_id'] || raise("Blank indicator ID around row #{data_points.count}")
      ind_meta = metadata[ind_id]  ## extra metadata passed through from load_meta_csv processing
      prefix = "DBEDT_#{ind_id}"
      area = row['area_id'].to_i
      ### Geography info hardwired in code for simplicity and convenience. Records are expected to already exist in db.
      geo_handle = [nil, 'HI', 'HAW', 'HON', 'KAU', 'MAU'][area] || raise("Area ID=#{area} is blank/unknown around row #{data_points.count}")
      geo_id = allgeos[geo_handle]
      unless geo_id
        allgeos[geo_handle] = Geography.get(universe: 'DBEDT', handle: geo_handle) || raise("Area handle #{geo_handle} missing from db")
        geo_id = allgeos[geo_handle].id
      end
      name = Series.build_name(prefix, geo_handle, row['frequency'])

      if current_measurement.nil? || current_measurement.prefix != prefix
        current_measurement = Measurement.find_by(universe: 'DBEDT', prefix: prefix) ||
            Measurement.create(universe: 'DBEDT', prefix: prefix, data_portal_name: ind_meta['indicatorfortable'])
      end

      if current_series.nil? || current_series.name != name
        source_str = ind_meta['source']
        source_id = nil
        if source_str.downcase != 'none'
          source_id = allsources[source_str]
          unless source_id
            allsources[source_str] = Source.get_or_new(source_str, nil, 'DBEDT').id rescue raise("Failed to create Source #{source_str}")
            source_id = allsources[source_str]
          end
        end
        unit_str = ind_meta['unit']
        unit_id = nil
        if unit_str.downcase != 'none'
          unit_id = allunits[unit_str]
          unless unit_id
            allunits[unit_str] = Unit.get_or_new(unit_str, 'DBEDT').id rescue raise("Failed to create Unit #{unit_str}")
            unit_id = allunits[unit_str]
          end
        end

        current_series = Series.find_by(universe: 'DBEDT', name: name)
        current_data_source = nil
        if current_series
          current_series.update!(
            description: ind_meta['indicatorfortable'],
            dataPortalName: ind_meta['indicatorfortable'],
            unit_id: unit_id,
            source_id: source_id,
            decimals: ind_meta['decimal'].to_i,
          )
          current_data_source = DataSource.find_by(universe: 'DBEDT', series_id: current_series.id)
        else
          current_series = Series.create_new(
            universe: 'DBEDT',
            name: name,
            frequency: Series.frequency_from_code(row['frequency']),
            geography_id: geo_id,
            description: ind_meta['indicatorfortable'],
            dataPortalName: ind_meta['indicatorfortable'],
            unit_id: unit_id,
            source_id: source_id,
            decimals: ind_meta['decimal'].to_i,
            units: 1
          )
        end
        current_data_source ||= DataSource.create(
            universe: 'DBEDT',
            eval: 'DbedtUpload.load(%d)' % current_series.id,
            description: 'Dummy loader for %s' % current_series.name,
            series_id: current_series.id,
            reload_nightly: false,
            last_run: Time.now
        )
        current_measurement.series << current_series
      end
      data_points.push({ xs_id: current_series.xseries_id,
                         ds_id: current_data_source.id,
                         date: make_date(row['year'], row['qm']),
                         value: row['value'] })
    end
    mylogger :info, 'load_series_csv: insert data points'
    if current_series && data_points.length > 0
      sql_stmt = NewDbedtUpload.connection.raw_connection.prepare(<<~MYSQL)
        INSERT INTO data_points (xseries_id,data_source_id,`date`,`value`,`current`,created_at) VALUES (?, ?, ?, ?, true, NOW());
      MYSQL
      data_points.in_groups_of(1000, false) do |dps|
        values = dps.compact.uniq {|dp| '%s %s %s' % [dp[:xs_id], dp[:ds_id], dp[:date]] }
                             .map {|dp| [dp[:xs_id], dp[:ds_id], dp[:date], dp[:value]] }
        db_execute_set sql_stmt, values
      end
    end
    mylogger :info, 'done load_series_csv'
    data_points.count
  end

  def load_postproc(num)
    num  ## nothing to do (yet), except return the number of loaded data points that is passed in
  end

  def full_load
    delete_universe_dbedt
    load_postproc( load_series_csv( load_meta_csv ) )
  end

  def worker_tasks(do_csv_proc: false)
    csv_extract if do_csv_proc
    mylogger :info, 'worker_tasks: before full_load'
    total = full_load
    self.transaction do
      NewDbedtUpload.update_all(active: false)
      self.update_attributes(status: :ok, active: true, last_error_at: nil, last_error: "#{total} data points loaded")
    end
    mylogger :info, 'worker_tasks: loaded and active'
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
      mylogger :warn, 'WARNING! Attempt to access filesystem path %s' % name
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
      mylogger :error, e.message
      return false
    end
    true
  end

  def read_file_from_disk(name)
    begin
      content = File.open(path(name), 'r') { |f| f.read }
    rescue StandardError => e
      mylogger :error, e.message
      return false
    end
    content
  end

  def delete_file_from_disk(abspath)
    begin
      File.delete(abspath)
    rescue StandardError => e
      mylogger :error, e.message
      return false
    end
    true
  end

  def db_execute(stmt, values = [])
    if stmt.class == String
      stmt = NewDbedtUpload.connection.raw_connection.prepare(stmt)
    end
    stmt.execute(*values)  ## if you don't know what this * is, you can google for "ruby splat"
  end

  def db_execute_set(stmt, set)
    if stmt.class == String
      stmt = NewDbedtUpload.connection.raw_connection.prepare(stmt)
    end
    set.each {|values| stmt.execute(*values) }
  end

  def make_date(year, mq)
    month = 1
    begin
      if mq =~ /([MQ])(\d+)/i
        month = case $1.upcase
                when 'M' then $2.to_i
                when 'Q' then first_month_of_quarter($2)
                else raise('boom')
                end
      end
      Date.new(year, month).to_s
    rescue
      year_msg = year.blank? ? ' is empty' : "=#{year}"
      raise "Bad date params: year#{year_msg}, QM='#{mq}'"
    end
  end

  def mylogger(level, message)
    Rails.logger.send(level) { "#{Time.now} NewDbedtUpload id=#{self.id}: #{message}" }
  end
end
