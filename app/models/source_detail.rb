class SourceDetail < ApplicationRecord
  include Cleaning
  has_many :series
  has_many :measurements
end
