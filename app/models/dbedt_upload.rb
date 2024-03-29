class DbedtUpload < ApplicationRecord
  require 'date'
  include HelperUtilities
  before_destroy :delete_files_from_disk
  before_destroy :delete_data_and_data_sources

  enum status: { processing: 'processing', ok: 'ok', fail: 'fail' }

  def store_upload_files(cats_file, series_file)
    now = Time.now
    cats_file_content = cats_file && cats_file.read
    cats_file_ext =     cats_file && cats_file.original_filename.split('.')[-1]
    if cats_file
      self.cats_filename = DbedtUpload.make_filename(now, 'cats', cats_file_ext)
      self.cats_status = :processing
    end
    series_file_content = series_file && series_file.read
    series_file_ext =     series_file && series_file.original_filename.split('.')[-1]
    if series_file
      self.series_filename = DbedtUpload.make_filename(now, 'series', series_file_ext)
      self.series_status = :processing
    end

    self.upload_at = Time.now
    begin
      self.save or raise StandardError, 'DBEDT upload object save failed'

      Rails.logger.info { "DbedtUpload id=#{id} Start deleting universe DBEDT" }
      DbedtUpload.delete_universe_dbedt
      Rails.logger.info { "DbedtUpload id=#{id} DONE deleting universe DBEDT" }

      if cats_file
        write_file_to_disk(cats_filename, cats_file_content) or raise StandardError, 'DBEDT upload disk write failed'
        XlsCsvWorker.perform_async(id, 'cats')
      end
      if series_file
        write_file_to_disk(series_filename, series_file_content) or raise StandardError, 'DBEDT upload disk write failed'
        XlsCsvWorker.perform_async(id, 'series')
      end
    rescue StandardError => e
      self.delete if e.message =~ /disk write failed/
      return false
    end
    true
  end

  def set_active(status)
    self.update! :active => status
  end

  def make_active
    DbedtUpload.update_all active: false
    DbedtLoadWorker.perform_async(self.id)
    self.update cats_status: 'processing'
  end

  def make_active_settings
    unless DataPoint.update_public_data_points('DBEDT')
      Rails.logger.warn { 'FAILED to update public_data_points' }
      return false
    end
    Rails.logger.info { 'DONE DataPoint.update_public_data_points' }
    self.transaction do
      DbedtUpload.update_all active: false
      self.update active: true, last_error: nil, last_error_at: nil
    end
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

  def absolute_path(which=nil)
    if which == 'cats'
      path(cats_filename)
    elsif which == 'series'
      path(series_filename)
    else
      path
    end
  end

  def retrieve_cats_file
    read_file_from_disk(cats_filename)
  end

  def retrieve_series_file
    read_file_from_disk(series_filename)
  end

  def delete_cats_file
    if cats_filename && File.exists?(absolute_path('cats'))
      r = true
      Dir.glob(absolute_path('cats').change_file_extension('*')) do |f|
        r &&= delete_file_from_disk(f)
      end
      return (r || throw(:abort))
    end
    true
  end

  def delete_series_file
    if series_filename && File.exists?(absolute_path('series'))
      r = true
      Dir.glob(absolute_path('series').change_file_extension('*')) do |f|
        r &&= delete_file_from_disk(f)
      end
      return (r || throw(:abort))
    end
    true
  end

  def DbedtUpload.delete_universe_dbedt
    ## Series, Xseries, and DataSources are NOT deleted, but updated as necessary.
    ## Geographies also not deleted, but handled in hardcoded fashion.
    ## Categories and DataLists deleted in Rails code.
    DbedtUpload.connection.execute <<~SQL
        SET FOREIGN_KEY_CHECKS = 0;
    SQL
    Rails.logger.info { 'delete_universe_dbedt: public_data_points' }
    DbedtUpload.connection.execute <<~SQL
      delete p
      from public_data_points p join series s on s.id = p.series_id
      where s.universe = 'DBEDT' ;
    SQL
    Rails.logger.info { 'delete_universe_dbedt: data_points' }
    DbedtUpload.connection.execute <<~SQL
      delete d
      from data_points d join series s on s.xseries_id = d.xseries_id
      where s.universe = 'DBEDT' ;
    SQL
    Rails.logger.info { 'delete_universe_dbedt: measurement_series' }
    DbedtUpload.connection.execute <<~SQL
      delete ms from measurement_series ms join measurements m on m.id = ms.measurement_id where m.universe = 'DBEDT' ;
    SQL
    Rails.logger.info { 'delete_universe_dbedt: data_list_measurements' }
    DbedtUpload.connection.execute <<~SQL
      delete dm from data_list_measurements dm join data_lists d on d.id = dm.data_list_id where d.universe = 'DBEDT' ;
    SQL
    Rails.logger.info { 'delete_universe_dbedt: measurements' }
    DbedtUpload.connection.execute <<~SQL
      delete from measurements where universe = 'DBEDT' ;
    SQL
    Rails.logger.info { 'delete_universe_dbedt: units' }
    DbedtUpload.connection.execute <<~SQL
      delete from units where universe = 'DBEDT' ;
    SQL
    Rails.logger.info { 'delete_universe_dbedt: sources' }
    DbedtUpload.connection.execute <<~SQL
      delete from sources where universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
        SET FOREIGN_KEY_CHECKS = 1;
    SQL
  end

  def load_csv(which)
    which == 'cats' ? load_cats_csv : load_series_csv
  end

  def load_cats_csv
    Rails.logger.info { 'starting load_cats_csv' }
    unless cats_filename
      Rails.logger.error { "DBEDT Upload id=#{id}: no cats_filename" }
      return false
    end

    cats_csv_path = path(cats_filename).change_file_extension('csv')
    unless File.exists?(cats_csv_path) || ENV['OTHER_WORKER'] && system("rsync -t #{ENV['OTHER_WORKER'] + ':' + cats_csv_path} #{absolute_path}")
      Rails.logger.error { "DBEDT Upload id=#{id}: couldn't find file #{cats_csv_path}" }
      return false
    end

    # clean out the things, but not the root category
    Category.where('universe = "DBEDT" and ancestry is not null').delete_all
    DataList.where(universe: 'DBEDT').destroy_all
    category = nil
    CSV.foreach(cats_csv_path, {col_sep: "\t", headers: true, return_headers: false}) do |row|
      # category entry
      indicator_id = row[3]
      parent_indicator_id = row[4]
      parent_label = "DBEDT_#{parent_indicator_id}"
      if row[2].blank?
        break if indicator_id.blank?  ## end of file
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
              name: row[1],
              ancestry: ancestry,
              list_order: row[5]
          )
          Rails.logger.info { "DBEDT Upload id=#{id}: created category #{category.meta} in universe #{category.universe}" }
        end
      end

      # data_list_measurements entry
      unless row[2].blank?
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
              data_portal_name: row[0]
          )
        else
          measurement.update data_portal_name: row[0]
        end
        if data_list.measurements.where(id: measurement.id).empty?
          data_list.measurements << measurement
        end
        dlm = DataListMeasurement.find_by(data_list_id: data_list.id, measurement_id: measurement.id)
        dlm.update(list_order: row[5].to_i) if dlm
        Rails.logger.debug { "added measurement #{measurement.prefix} to data_list #{data_list.name}" }
      end
    end
    Rails.logger.info { 'done load_cats_csv' }
    true
  end

  def load_series_csv(run_active_settings: false)
    Rails.logger.info { 'starting load_series_csv' }
    unless series_filename
      Rails.logger.error { "DBEDT Upload id=#{id}: no series_filename" }
      return false
    end

    series_csv_path = path(series_filename).change_file_extension('csv')
    unless File.exists?(series_csv_path) || ENV['OTHER_WORKER'] && system("rsync -t #{ENV['OTHER_WORKER'] + ':' + series_csv_path} #{absolute_path}")
      Rails.logger.error { "DBEDT Upload id=#{id}: couldn't find file #{series_csv_path}" }
      return false
    end

    Rails.logger.debug { 'loading DBEDT data' }
    current_series = nil
    current_data_source = nil
    current_measurement = nil
    data_points = []
    Rails.logger.info { 'load_series_csv: read lines from csv file' }
    CSV.foreach(series_csv_path, {col_sep: "\t", headers: true, return_headers: false}) do |row|
      prefix = "DBEDT_#{row[0]}"
      region = row[3].strip
      (geo_handle, geo_fips) = get_geo_codes(region)
      name = Series.build_name(prefix, geo_handle, row[4])
      if current_measurement.nil? || current_measurement.prefix != prefix
        current_measurement =
            Measurement.find_by(universe: 'DBEDT', prefix: prefix) ||
             Measurement.create(universe: 'DBEDT', prefix: prefix, data_portal_name: row[1])
      end

      if current_series.nil? || current_series.name != name
        source_str = row[9] && row[9].to_ascii.strip
        source = (source_str.blank? || source_str.downcase == 'none') ? nil : Source.get_or_new(source_str, nil, 'DBEDT')
        geo_id = Geography.get_or_new_dbedt({ handle: geo_handle },
                                            { fips: geo_fips, display_name: region, display_name_short: region}).id
        unit_str = row[8] && row[8].to_ascii.strip
        unit = (unit_str.blank? || unit_str.downcase == 'none') ? nil : Unit.get_or_new(unit_str, 'DBEDT')
        raise "No decimals specified for series #{name}" if row[10].blank?

        current_series = Series.find_by(universe: 'DBEDT', name: name)
        if current_series
          current_series.update!(
              description: row[1],
              dataPortalName: row[1],
              unit_id: unit && unit.id,
              source_id: source && source.id,
              decimals: row[10],
          )
          current_data_source =  ## wrap the following as a DataSource.get_or_new_dbedt() method, similar to Geos
              DataSource.find_by(universe: 'DBEDT', eval: 'DbedtUpload.load(%d)' % current_series.id) ||
              DataSource.create(
                  universe: 'DBEDT',
                  eval: 'DbedtUpload.load(%d)' % current_series.id,
                  description: 'Dummy loader for %s' % current_series.name,
                  series_id: current_series.id,
                  reload_nightly: false,
                  last_run: Time.now
              )
        else
          current_series = Series.create_new(
              universe: 'DBEDT',
              name: name,
              frequency: Series.frequency_from_code(row[4]),
              geography_id: geo_id,
              description: row[1],
              dataPortalName: row[1],
              unit_id: unit && unit.id,
              source_id: source && source.id,
              decimals: row[10]
          )
          current_data_source = DataSource.create(
              universe: 'DBEDT',
              eval: 'DbedtUpload.load(%d)' % current_series.id,
              description: 'Dummy loader for %s' % current_series.name,
              series_id: current_series.id,
              reload_nightly: false,
              last_run: Time.now
          )
        end
        current_measurement.series << current_series
        ##Rails.logger.debug { "added series #{current_series.name} to measurement #{current_measurement.prefix}" }
        ## don't need this, eh?  ## current_data_source.update last_run_in_seconds: Time.now.to_i
      end
      data_points.push({xs_id: current_series.xseries_id,
                        ds_id: current_data_source.id,
                        date: get_date(row[5], row[6]).to_s,
                        value: row[7]})
    end
    Rails.logger.info { 'load_series_csv: insert data points' }
    if current_series && data_points.length > 0
      data_points.in_groups_of(1000, false) do |dps|
        values = dps.compact
                     .uniq {|dp| '%s %s %s' % [dp[:xs_id], dp[:ds_id], dp[:date]] }
                     .map {|dp| %q|(%s, %s, STR_TO_DATE('%s','%%Y-%%m-%%d'), %s, true, NOW())| % [dp[:xs_id], dp[:ds_id], dp[:date], dp[:value]] }
                     .join(',')
        DbedtUpload.connection.execute <<~MYSQL
          INSERT INTO data_points (xseries_id,data_source_id,`date`,`value`,`current`,created_at) VALUES #{values};
        MYSQL
      end
    end
    success = run_active_settings ? make_active_settings : true
    Rails.logger.info { 'done load_series_csv' }
    success
  end

  def DbedtUpload.load(series_id)
    raise "You cannot load individual series that way (#{series_id})"
  end

private

  def path(name = nil)
    parts = [ENV['DATA_PATH'], 'dbedt_files']
    parts.push(name) unless name.blank?
    File.join(parts)
  end

  def DbedtUpload.make_filename(time, type, ext)
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
    delete_cats_file && delete_series_file
  end

  def delete_data_and_data_sources
    DbedtUpload.connection.execute <<~SQL
      DELETE FROM data_points
      WHERE data_source_id IN (
        SELECT id FROM data_sources WHERE eval LIKE 'DbedtUpload.load(#{self.id},%)'
      );
    SQL
    DataSource.where("eval LIKE 'DbedtUpload.load(#{self.id},%)'").delete_all
  end

  def get_geo_codes(name)
    handles = {
        'hawaii county' => ['HAW', 15001],
        'honolulu county' => ['HON', 15003],
        'kauai county' => ['KAU', 15007],
        'maui county' => ['MAU', 15009],
        'statewide' => ['HI', 15],
    }
    handles[name.downcase] || raise("Unknown DBEDT geography '#{name}'")
  end

  def get_date(year, qm)
    year = year.to_i
    if qm =~ /^M(\d+)/i
      Date.new(year, $1.to_i)
    elsif qm =~ /^Q0?(\d+)/i
      qspec_to_date("#{year}#{qm}")
    elsif qm.nil? || qm.empty? || qm =~ /A/i
      Date.new(year)
    else
      Date.new(year, 12, 31)  ## use this as an error code? :=}
    end
  end

end
