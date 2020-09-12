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
        series = Series.find_by(universe: 'UHERO', name: new) || raise("Unknown series name #{new}")
        (self.series << series) rescue raise("Series #{new} duplicated?")
      end
    end
  end

  def duplicate(universe, name_transform = nil, properties = {})
    new_m = self.dup
    ## handle unit
    if create_properties
      #puts "foo"
    end
    ## handle source
    if create_properties
      #puts "bar"
    end
    new_name = name_transform ? name_transform.call(name) : name
    new_m.assign_attributes(properties.merge(universe: universe, name: new_name))
    new_m.save!
    series.each do |s|
      al = s.create_alias(universe: universe)
      (new_m.series << al) rescue raise("Series #{new} duplicated?")
    end
  end

end
