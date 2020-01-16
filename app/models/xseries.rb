class Xseries < ApplicationRecord
  include Cleaning
  before_destroy :last_rites, prepend: true

  has_many :series, inverse_of: :xseries
  has_one :primary_series, class_name: 'Series'
  has_many :data_points, dependent: :delete_all

  serialize :factors, Hash

  def last_rites
    ### The use of throw(:abort) prevents the object from being destroyed
    throw(:abort) if somethingggggggg
  end
end
