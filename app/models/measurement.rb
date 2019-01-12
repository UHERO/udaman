class Measurement < ApplicationRecord
  include Cleaning
  has_many :data_list_measurements, optional: true, dependent: :delete_all
  has_many :data_lists, optional: true, through: :data_list_measurements

  belongs_to :source, optional: true, inverse_of: :measurements
  belongs_to :source_detail, optional: true, inverse_of: :measurements
  belongs_to :unit, optional: true, inverse_of: :measurements

  has_many :measurement_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :measurement_series
  accepts_nested_attributes_for :series

  enum seasonal_adjustment: { NA: 'not_applicable',
                              SA: 'seasonally_adjusted',
                              NS: 'not_seasonally_adjusted' }

  def prefix_and_name
    "#{prefix} -> #{data_portal_name}"
  end

  def add_series(series)
    self.transaction do
      series.update_attributes(universe: 'DBEDTCOH') if universe == 'DBEDTCOH'
      self.series << series
    end
  end

  def remove_series(series)
    self.transaction do
      self.series.destroy(series)
      if universe == 'DBEDTCOH'
        unless series.measurements.map(&:universe).include?('DBEDTCOH')
          series.update_attributes(universe: 'DBEDT')
        end
      end
    end
  end
end
