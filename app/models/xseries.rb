class Xseries < ApplicationRecord
  include Cleaning
  include SeriesInheritXseries

  has_many :series, inverse_of: :xseries
  has_one :primary_series, class_name: 'Series'
  has_many :data_points, dependent: :delete_all

end
