class Xseries < ApplicationRecord
  include Cleaning

  has_many :series, inverse_of: :xseries
  belongs_to :primary_series, class_name: 'Series'
  has_many :data_points, dependent: :delete_all

end
