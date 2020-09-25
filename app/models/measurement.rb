class Measurement < ApplicationRecord
  include Cleaning
  has_many :data_list_measurements, dependent: :delete_all
  has_many :data_lists, through: :data_list_measurements

  belongs_to :source, optional: true, inverse_of: :measurements
  belongs_to :source_detail, optional: true, inverse_of: :measurements
  belongs_to :unit, optional: true, inverse_of: :measurements

  has_many :measurement_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :measurement_series
  accepts_nested_attributes_for :series

  enum seasonal_adjustment: { not_applicable: 'not_applicable',
                              seasonally_adjusted: 'seasonally_adjusted',
                              not_seasonally_adjusted: 'not_seasonally_adjusted' }

  def to_s
    '%s/%s' % [universe, prefix]
  end

  def prefix_and_name
    "#{prefix} -> #{data_portal_name}"
  end

  def replace_all_series(new_s_list)
    my_series = series.includes(:measurement_series)  ## eager load the bridge table
                      .dup   ## make a copy so that we can modify while looping over

    self.transaction do
      my_series.each do |s|
        ord = new_s_list.index(s.name)
        if ord
          new_s_list[ord] = '_done'
        else
          series.delete(s)
        end
      end
      new_s_list.each do |new|
        next if new == '_done'
        series = Series.find_by(universe: 'UHERO', name: new) || raise("Unknown UHERO series name #{new}")
        (self.series << series) rescue raise("Series #{new} duplicated?")
      end
    end
  end

  ## These methods exist primarily for copying/aliasing data portal structures into a new universe
  ## from an existing one (cf task :ua_1367). They are not exposed to the udaman UI.
  ## They do not presently handle detailed property-setting for the contained Series.
  def Measurement.deep_copy_to_universe(prefix_list, universe, name_trans_f = nil, properties = {})
    prefix_list.each do |p|
      puts ">>> Doing #{p}"
      begin
        m = Measurement.find_by(universe: 'UHERO', prefix: p) || raise("UHERO measurement #{p} not found")
        m.duplicate(universe, name_trans_f, properties.merge(deep_copy: true))
      rescue => e
        puts "ERROR for #{p} ==================== #{e.message}"
        next
      end
    end
  end

  def duplicate(universe, name_trans_f = nil, properties = {})
    universe.upcase!
    raise "Cannot duplicate #{self} into same universe #{universe}" if universe == self.universe
    new_name = name_trans_f ? name_trans_f.call(prefix) : prefix
    raise("Cannot duplicate because #{new_name} already exists in #{universe}") if Measurement.find_by(universe: universe, prefix: new_name)
    include_series = properties.delete(:deep_copy)
    new_m = self.dup
    new_m.assign_attributes(properties.merge(universe: universe, prefix: new_name))
    new_m.save!
    if include_series
      series.each do |s|
        begin
          ali_s = s.create_alias(universe: universe)
        rescue => e
          puts "ERROR for #{s} -------------- #{e.message}"
          next
        end
        (new_m.series << ali_s) rescue raise("Series #{ali_s} link to Meas #{new_m} duplicated?")
      end
    end
  end

end
