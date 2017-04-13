class Measurement < ActiveRecord::Base
  has_many :data_list_measurements, dependent: :delete_all
  has_many :data_lists, through: :data_list_measurements

  belongs_to :source, inverse_of: :measurements
  belongs_to :source_detail, inverse_of: :measurements
  belongs_to :unit, inverse_of: :measurements

  has_many :measurement_series, dependent: :delete_all
  has_many :series, -> {distinct}, through: :measurement_series
  accepts_nested_attributes_for :series

  enum seasonal_adjustment: { seas_adj_not_applicable: 'not_applicable',
                              seas_adj: 'seasonally_adjusted',
                              non_seas_adj: 'non_seasonally_adjusted' }

  def prefix_and_name
    "#{prefix} -> #{data_portal_name}"
  end
end
