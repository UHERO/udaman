class DbedtUpload < ApplicationRecord
  require 'date'
  before_destroy :delete_files_from_disk
  before_destroy :delete_data_and_data_sources

  enum status: { processing: 'processing', ok: 'ok', fail: 'fail' }

  def store_upload_files(cats_file, series_file)
    now = Time.now
    if cats_file
      cats_file_content = cats_file.read
      cats_file_ext = cats_file.original_filename.split('.')[-1]
      self.cats_filename = DbedtUpload.make_filename(now, 'cats', cats_file_ext)
      self.cats_status = :processing
    end
    if series_file
      series_file_content = series_file.read
      series_file_ext = series_file.original_filename.split('.')[-1]
      self.series_filename = DbedtUpload.make_filename(now, 'series', series_file_ext)
      self.series_status = :processing
    end

    self.upload_at = Time.now
    begin
      self.save or raise StandardError, 'DBEDT upload object save failed'
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
    unless DataPoint.update_public_data_points 'DBEDT'
      Rails.logger.debug { 'FAILED to update public_data_points' }
      return false
    end
    Rails.logger.debug { 'DONE DataPoint.update_public_data_points' }
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
    DbedtUpload.connection.execute <<~SQL
        SET FOREIGN_KEY_CHECKS = 0;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete p
      from public_data_points p join series s on s.id = p.series_id
      where s.universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete d
      from data_points d join series s on s.xseries_id = d.xseries_id
      where s.universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete ms from measurement_series ms join measurements m on m.id = ms.measurement_id where m.universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete dm from data_list_measurements dm join data_lists d on d.id = dm.data_list_id where d.universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete from data_sources where universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete from series where universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete x
      from xseries x join series s on s.xseries_id = x.id
      where s.universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete from measurements where universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete from units where universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete from sources where universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete gt from geo_trees gt join geographies g on g.id = gt.parent_id where g.universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete from geographies where universe = 'DBEDT' ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete from categories where universe = 'DBEDT' and ancestry is not null ;
    SQL
    DbedtUpload.connection.execute <<~SQL
      delete from data_lists where universe = 'DBEDT'  ;
    SQL
    DbedtUpload.connection.execute <<~SQL
        SET FOREIGN_KEY_CHECKS = 1;
    SQL
  end

  def load_csv(which)
    if which == 'cats'
      return load_cats_csv
    end
    load_series_csv
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

  def load_series_csv(run_active_settings = false)
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

    # if data_sources exist => set their current: true
    if DataSource.where("eval LIKE 'DbedtUpload.load(#{id},%)'").count > 0
      Rails.logger.debug { 'DBEDT data already loaded' }
      set_this_load_dp_as_current
      return true
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
        current_measurement = Measurement.find_by(universe: 'DBEDT', prefix: prefix)
        if current_measurement.nil?
          current_measurement = Measurement.create(
              universe: 'DBEDT',
              prefix: prefix,
              data_portal_name: row[1]
          )
        end
      end

      if current_series.nil? || current_series.name != name
        # need a fresh data_source for each series unless I make series - data_sources a many-to-many relationship
        source_str = row[9] && row[9].to_ascii.strip
        source = (source_str.blank? || source_str.downcase == 'none') ? nil : Source.get_or_new(source_str, nil, 'DBEDT')
        geo_id = Geography.get_or_new_dbedt({ handle: geo_handle },
                                            { fips: geo_fips, display_name: region, display_name_short: region}).id
        unit_str = row[8] && row[8].to_ascii.strip
        unit = (unit_str.blank? || unit_str.downcase == 'none') ? nil : Unit.get_or_new(unit_str, 'DBEDT')

        current_series = Series.find_by(universe: 'DBEDT', name: name)
        if current_series.nil?
          current_series = Series.create_new(
              universe: 'DBEDT',
              name: name,
              frequency: Series.frequency_from_code(row[4]),
              geography_id: geo_id,
              description: row[1],
              dataPortalName: row[1],
              unit_id: unit && unit.id,
              source_id: source && source.id,
              decimals: row[10],
              units: 1
          )
        end
        if current_measurement.series.where(id: current_series.id).empty?
          current_measurement.series << current_series
          Rails.logger.debug { "added series #{current_series.name} to measurement #{current_measurement.prefix}" }
        end
        current_data_source = DataSource.find_by(universe: 'DBEDT', eval: "DbedtUpload.load(#{id}, #{current_series.id})")
        if current_data_source.nil?
          current_data_source = DataSource.create(
              universe: 'DBEDT',
              eval: "DbedtUpload.load(#{id}, #{current_series.id})",
              description: "DBEDT Upload #{id} for series #{current_series.id}",
              series_id: current_series.id,
              reload_nightly: false,
              last_run: Time.now
          )
        end
        current_data_source.update last_run_in_seconds: Time.now.to_i
      end
      data_points.push({xs_id: current_series.xseries_id,
                        ds_id: current_data_source.id,
                        date: get_date(row[5], row[6]),
                        value: row[7]})
    end
    Rails.logger.info { 'load_series_csv: insert data points' }
    if data_points.length > 0 && !current_series.nil?
      data_points.in_groups_of(1000, false) do |dps|
        values = dps.compact
                     .uniq {|dp| '%s %s %s' % [dp[:xs_id], dp[:ds_id], dp[:date]] }
                     .map {|dp| %q|(%s, %s, STR_TO_DATE('%s','%%Y-%%m-%%d'), %s, false, NOW())| % [dp[:xs_id], dp[:ds_id], dp[:date], dp[:value]] }
                     .join(',')
        DbedtUpload.connection.execute <<~MYSQL
          INSERT INTO data_points (xseries_id,data_source_id,`date`,`value`,`current`,created_at) VALUES #{values};
        MYSQL
      end
    end
    set_this_load_dp_as_current
    success = run_active_settings ? make_active_settings : true
    Rails.logger.info { 'done load_series_csv' }
    success
  end

  def set_this_load_dp_as_current
    Rails.logger.info { 'load_series_csv: set all DBEDT data points to current = false' }
    DbedtUpload.connection.execute <<~MYSQL
      update data_points dp join data_sources ds on ds.id = dp.data_source_id
      set dp.current = false where ds.eval LIKE 'DbedtUpload.load(%)'
    MYSQL
    Rails.logger.info { 'load_series_csv: set all DBEDT data points for id to current = true' }
    DbedtUpload.connection.execute <<~MYSQL % [id]
      update data_points dp join data_sources ds on ds.id = dp.data_source_id
      set dp.current = true where ds.eval LIKE 'DbedtUpload.load(%d,%%)'
    MYSQL
  end

  def DbedtUpload.load(id, series_id)
    du = DbedtUpload.find_by(id: id)
    du.load_series_csv(true)
  end

private
  def path_prefix
    'dbedt_files'
  end

  def path(name=nil)
    parts = [ENV['DATA_PATH'], path_prefix]
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
    if qm =~ /^M(\d+)/i
      "#{year}-%02d-01" % $1.to_i
    elsif qm =~ /^Q(\d+)/i
      quarter_month = '%02d' % (($1.to_i - 1) * 3 + 1)
      "#{year}-#{quarter_month}-01"
    elsif qm.nil? || qm.empty? || qm =~ /A/i
      "#{year}-01-01"
    else
      "#{year}-12-31"  ## use this as an error code? :=}
    end
  end

end
